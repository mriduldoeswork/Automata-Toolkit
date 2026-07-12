/**
 * @fileoverview Handles the mathematical complementation of a Deterministic Finite Automaton (DFA).
 * The complement of a DFA accepts exactly the strings that the original DFA rejects.
 */

import { automata, setComplementedDfa, complementedDfa } from './state.js';
import { updateUIWithNewAutomata } from './ui-controller.js';

/**
 * Prepares a DFA for complementation by ensuring it has a Total Transition Function.
 * A "dead state" or "sink state" must be injected if any transitions are missing.
 * Without this, invalid strings might just crash/halt instead of properly routing 
 * to a rejecting state that would become an accepting state after complementation.
 *
 * @param {import('./state.js').Automaton} dfa - The input DFA.
 * @returns {import('./state.js').Automaton} A fully complete DFA safely traversable for all strings.
 */
export function completeDfa(dfa) {
    const sinkState = "deadState";
    let needsSinkState = false;
    const transitions = JSON.parse(JSON.stringify(dfa.transitions));
    const states = [...dfa.states];

    for (const state of states) {
        if (!transitions[state]) {
            transitions[state] = {};
        }
        for (const char of dfa.alphabet) {
            const targets = transitions[state][char];
            if (!targets || (Array.isArray(targets) && targets.length === 0)) {
                needsSinkState = true;
                transitions[state][char] = [sinkState];
            }
        }
    }

    if (needsSinkState) {
        if (!states.includes(sinkState)) {
            states.push(sinkState);
        }
        if (!transitions[sinkState]) {
            transitions[sinkState] = {};
        }
        dfa.alphabet.forEach(char => {
            transitions[sinkState][char] = [sinkState];
        });
    }

    return { ...dfa, states, transitions };
}

/**
 * Executes the complementation of the currently active DFA.
 * It completes the DFA first, then mathematically inverts the accept states.
 * 
 * @returns {void} Mutates the global state via setComplementedDfa and updates UI.
 */
export function complementDFAAction() {
    if (!automata) {
        alert('No automaton found. Please generate or import an automaton first.');
        return;
    }
    if (automata.type !== 'DFA') {
        alert('Error: The Complement operation is only valid for a DFA. Please ensure you are viewing a DFA.');
        return;
    }

    const completedDfa = completeDfa(automata);

    // Inversion Logic: States that were NOT accept states become accept states, and vice versa.
    const allStates = completedDfa.states;
    const currentAcceptStates = completedDfa.accept || [];
    
    const newAcceptStates = allStates.filter(state => !currentAcceptStates.includes(state));
    
    const complementedDfaState = {
        ...completedDfa,
        accept: newAcceptStates
    };

    setComplementedDfa(complementedDfaState);
    updateUIWithNewAutomata(complementedDfaState, "Displaying Complement DFA.");
}

/**
 * Restores the Complement DFA view from the application state cache.
 * @returns {void}
 */
export function showComplementDFA() {
    if (complementedDfa) {
        updateUIWithNewAutomata(complementedDfa, "Displaying Complement DFA.");
    } else {
        alert("No Complemented DFA version available. Please generate it first.");
    }
}

// Expose globally so the inline onclick handler in index.html can access it
window.complementDFA = complementDFAAction;

// Attach to uiController for the Automata Versions button and hook into showDFA
document.addEventListener("DOMContentLoaded", () => {
    if (!window.uiController) window.uiController = {};
    window.uiController.showComplementDFA = showComplementDFA;
});