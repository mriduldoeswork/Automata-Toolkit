/**
 * @fileoverview Core computer science algorithms for automata traversal and Epsilon-NFA (e-NFA) operations.
 * Contains pure functions for computing mathematical closures, state traversals, and removing epsilon transitions.
 */

/**
 * Computes the Epsilon (ε) closure for a given set of states using Breadth-First Search (BFS).
 * The ε-closure of a state includes the state itself and all states reachable 
 * by following only epsilon ('#') transitions.
 *
 * @param {Set<string>|Array<string>} stateSet - The initial states to compute the closure for.
 * @param {Object} transitions - The transition mapping of the automaton.
 * @returns {{states: Set<string>, edges: Set<string>}} An object containing the computed state closure 
 *                                                      and the specific edge IDs traversed (used for UI highlighting).
 */
export function getEpsilonClosure(stateSet, transitions) {
    let closure = new Set(stateSet);
    let edges = new Set();
    let stack = Array.from(stateSet);

    // Perform BFS traversal along all '#' transitions
    while (stack.length > 0) {
        const state = stack.pop();
        const epsilonTargets = (transitions[state] && transitions[state]["#"]) || [];
        epsilonTargets.forEach(target => {
            if (!closure.has(target)) {
                closure.add(target);
                stack.push(target);
                edges.add(`edge-${state}-${target}-#`);
            }
        });
    }
    return { states: closure, edges };
}

/**
 * Determines the exact set of states an automaton will reach after reading a specific symbol.
 * 
 * @param {Set<string>} currentStates - The set of states the machine is currently in.
 * @param {string} symbol - The input character being read from the tape.
 * @param {Object} transitions - The transition mapping.
 * @param {boolean} isNFA - Flag indicating if epsilon closures should be applied after reading the symbol.
 * @returns {{states: Set<string>, edges: Set<string>}} The next states and the visual edges traversed.
 */
export function getNextStates(currentStates, symbol, transitions, isNFA) {
    let nextSet = new Set();
    let edges = new Set();
    
    // Step 1: Transition on the explicit symbol
    currentStates.forEach(s => {
        const targets = (transitions[s] && transitions[s][symbol]) || [];
        targets.forEach(t => {
            nextSet.add(t);
            edges.add(`edge-${s}-${t}-${symbol}`);
        });
    });

    // Step 2: If it's an e-NFA, we must automatically compute the epsilon closure of the resulting states
    if (isNFA) {
        const closureResult = getEpsilonClosure(nextSet, transitions);
        closureResult.edges.forEach(e => edges.add(e));
        return { states: closureResult.states, edges: edges };
    }
    
    return { states: nextSet, edges: edges };
}

/**
 * Mathematically converts an Epsilon-NFA (e-NFA) into a standard NFA.
 * The algorithm ensures the language accepted remains identical by computing the extended 
 * transition function: delta'(q, a) = e-closure(delta(e-closure(q), a)).
 *
 * @param {Automaton} nfa - The e-NFA to convert.
 * @returns {Automaton} A new NFA object free of '#' transitions.
 */
export function removeEpsilonTransitions(nfa) {
    const newTransitions = {};
    const newAlphabet = nfa.alphabet.filter(s => s !== '#');

    nfa.states.forEach(state => {
        newTransitions[state] = {};
        // Step 1: Get E-closure of the starting state
        const { states: closure } = getEpsilonClosure([state], nfa.transitions);
        newAlphabet.forEach(symbol => {
            let nextStates = new Set();
            // Step 2: Transition on the symbol from all states in the E-closure
            closure.forEach(s => {
                const targets = (nfa.transitions[s] && nfa.transitions[s][symbol]) || [];
                targets.forEach(t => nextStates.add(t));
            });
            let finalNext = new Set();
            // Step 3: Get the E-closure of the resulting target states
            nextStates.forEach(s => {
                const { states: finalClosure } = getEpsilonClosure([s], nfa.transitions);
                finalClosure.forEach(t => finalNext.add(t));
            });
            newTransitions[state][symbol] = Array.from(finalNext);
        });
    });

    // Step 4: Adjust Accepting States. 
    // If a state's epsilon closure contains an accepting state, the state itself becomes accepting.
    const newAccept = nfa.accept.slice();
    nfa.states.forEach(state => {
        if (!newAccept.includes(state)) {
            const { states: closure } = getEpsilonClosure([state], nfa.transitions);
            if (Array.from(closure).some(s => nfa.accept.includes(s))) {
                newAccept.push(state);
            }
        }
    });

    return {
        ...nfa,
        alphabet: newAlphabet,
        transitions: newTransitions,
        accept: newAccept,
    };
}