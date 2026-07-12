/**
 * @fileoverview Implements mathematical equivalence testing between two automata.
 * Uses state normalization, Cartesian product construction, and Breadth-First Search (BFS) 
 * to definitively prove if two machines accept the exact same language.
 */

import { removeEpsilonTransitions } from './automata-logic.js';
import { nfaToDfa } from './converter-logic.js';
import { minimizeDfa } from './minimize-logic.js';
import { normalizeAutomaton } from './automata-utils.js';

/**
 * Normalizes any automaton type (e-NFA, NFA, or DFA) into a strictly Minimized DFA.
 * This establishes a unified baseline for mathematical comparison.
 * 
 * @param {import('./state.js').Automaton} automaton - The source automaton.
 * @returns {import('./state.js').Automaton} A minimized DFA representing the exact same language.
 */
function normalizeToMinDFA(automaton) {
    let current = { ...automaton };
    if (current.type === 'ENFA') {
        current = removeEpsilonTransitions(current);
        current.type = 'NFA';
    }
    if (current.type === 'NFA') {
        current = nfaToDfa(current);
        current.type = 'DFA';
    }
    return normalizeAutomaton(minimizeDfa(current));
}

/**
 * Checks equivalence of two automata using BFS on their cartesian product.
 * It effectively runs both machines in parallel on identically generated inputs.
 * If one machine accepts while the other rejects, a shortest counter-example is found.
 *
 * @param {import('./state.js').Automaton} autoA - The first automaton to compare.
 * @param {import('./state.js').Automaton} autoB - The second automaton to compare.
 * @returns {{
 *   equivalent: boolean,
 *   counterExample: string|null,
 *   acceptedByA?: boolean,
 *   acceptedByB?: boolean,
 *   isomorphismMap: Object<string, string>|null,
 *   dfaA: import('./state.js').Automaton,
 *   dfaB: import('./state.js').Automaton
 * }} The equivalence test results, including isomorphism mapping or shortest counter-example string.
 */
export function checkEquivalence(autoA, autoB) {
    const dfaA = normalizeToMinDFA(autoA);
    const dfaB = normalizeToMinDFA(autoB);

    // Unify alphabets
    const alphabetSet = new Set([...dfaA.alphabet, ...dfaB.alphabet]);
    const unifiedAlphabet = Array.from(alphabetSet);

    // Queue controls the BFS traversal. 
    // `path` tracks the string read so far to produce accurate counter-examples.
    const queue = [{ stateA: dfaA.start, stateB: dfaB.start, path: "" }];
    const visited = new Set();
    const isomorphismMap = {};

    // Helper to safely get the next state, assuming a missing transition goes to a logical 'DEAD' state
    const getNext = (dfa, state, symbol) => {
        if (state === 'DEAD') return 'DEAD';
        const targets = dfa.transitions[state] && dfa.transitions[state][symbol];
        if (!targets) return 'DEAD';
        return Array.isArray(targets) ? targets[0] : targets; // It's a DFA, so targets is a single state or 1-item array
    };

    const isAccept = (dfa, state) => dfa.accept.includes(state);

    while (queue.length > 0) {
        const { stateA, stateB, path } = queue.shift();
        const visitKey = `${stateA},${stateB}`;

        if (visited.has(visitKey)) continue;
        visited.add(visitKey);
        
        // Only map non-dead states for isomorphism
        if (stateA !== 'DEAD' && stateB !== 'DEAD') {
            isomorphismMap[stateA] = stateB;
        }

        const acceptA = isAccept(dfaA, stateA);
        const acceptB = isAccept(dfaB, stateB);

        // Mismatch found!
        if (acceptA !== acceptB) {
            return {
                equivalent: false,
                counterExample: path === "" ? "ε (Empty String)" : path,
                acceptedByA: acceptA,
                acceptedByB: acceptB,
                isomorphismMap: null,
                dfaA,
                dfaB
            };
        }

        // Traverse for all symbols
        for (const symbol of unifiedAlphabet) {
            const nextA = getNext(dfaA, stateA, symbol);
            const nextB = getNext(dfaB, stateB, symbol);
            
            if (!visited.has(`${nextA},${nextB}`)) {
                queue.push({ stateA: nextA, stateB: nextB, path: path + symbol });
            }
        }
    }

    return {
        equivalent: true,
        counterExample: null,
        isomorphismMap,
        dfaA,
        dfaB
    };
}