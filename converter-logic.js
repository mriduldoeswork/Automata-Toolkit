/**
 * @fileoverview Logic for converting Non-Deterministic Finite Automata (NFA)
 * to Deterministic Finite Automata (DFA) using the formal Subset Construction algorithm.
 */
import { getEpsilonClosure } from './automata-logic.js';

/**
 * Helper function to generate deterministic compound state names.
 * E.g., NFA states {q0, q1} become DFA state "q0-q1".
 * 
 * @param {Set<string>} stateSet - The set of original NFA states.
 * @returns {string} The formatted DFA state name.
 */
function formatStateName(stateSet) {
    if (stateSet.size === 0) return "deadState";
    return Array.from(stateSet).sort().join("-");
}

/**
 * Converts an NFA (or e-NFA) into an equivalent DFA using Subset Construction.
 * This algorithm treats sets of NFA states as singular DFA states.
 *
 * @param {Automaton} nfa - The source NFA to convert.
 * @returns {Automaton} A newly constructed DFA representing the same language.
 */
export function nfaToDfa(nfa) {
    const dfaStates = [];
    const dfaTransitions = {};
    const dfaAccept = [];
    const stateMap = new Map();

    // Initialization: The start state of the DFA is the epsilon closure of the NFA's start state.
    const { states: startClosure } = getEpsilonClosure([nfa.start], nfa.transitions);
    const startName = formatStateName(startClosure);

    // Queue controls the BFS exploration of newly discovered subset states
    const queue = [startName];
    stateMap.set(startName, startClosure);
    dfaStates.push(startName);

    while (queue.length > 0) {
        const currentDfaName = queue.shift();
        const currentNfaSet = stateMap.get(currentDfaName);

        dfaTransitions[currentDfaName] = {};

        // Evaluate transitions for every symbol in the alphabet
        nfa.alphabet.forEach(symbol => {
            let nextSet = new Set();
            currentNfaSet.forEach(nfaState => {
                if (nfa.transitions[nfaState]) { 
                    const targets = nfa.transitions[nfaState][symbol] || [];
                    targets.forEach(t => nextSet.add(t));
                }
            });

            // Compute epsilon closure on the resulting targets to handle implicit e-transitions
            const { states: closureSet } = getEpsilonClosure(nextSet, nfa.transitions);
            const nextName = formatStateName(closureSet);

            // If we've generated a subset of states we haven't seen yet, enqueue it for processing
            if (!stateMap.has(nextName)) {
                stateMap.set(nextName, closureSet);
                dfaStates.push(nextName);
                queue.push(nextName);
            }

            dfaTransitions[currentDfaName][symbol] = [nextName];
        });

        // A DFA state is accepting if ANY of the NFA states it represents is accepting
        const isAccept = Array.from(currentNfaSet).some(s => nfa.accept.includes(s));
        if (isAccept) dfaAccept.push(currentDfaName);
    }

    return {
        type: "DFA",
        states: dfaStates,
        alphabet: nfa.alphabet,
        start: startName,
        accept: dfaAccept,
        transitions: dfaTransitions
    };
}
