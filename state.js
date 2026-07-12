/**
 * @fileoverview Global state management for the Automata Toolkit.
 * This module implements a centralized state store (Singleton pattern)
 * to manage the currently active automaton and its various converted forms.
 * It ensures that all UI components and rendering engines reference a single source of truth.
 */

/**
 * @typedef {Object} Automaton
 * @property {string} type - The type of the automaton ('ENFA', 'NFA', or 'DFA').
 * @property {string[]} states - Array of state names (e.g., ['q0', 'q1']).
 * @property {string[]} alphabet - Array of input symbols (e.g., ['0', '1']).
 * @property {string} start - The initial state (e.g., 'q0').
 * @property {string[]} accept - Array of accepting/final state names.
 * @property {Object.<string, Object.<string, string[]|string>>} transitions - The transition function mapping.
 *           Format: { state: { symbol: [targetStates] } } for NFA/eNFA,
 *           or { state: { symbol: [targetState] } } for DFA.
 */

/** @type {Automaton|null} The currently active automaton being viewed or simulated. */
export let automata = null;
/** @type {Automaton|null} The cached Epsilon-NFA configuration. */
export let enfa = null;
/** @type {Automaton|null} The cached NFA configuration. */
export let nfa = null;
/** @type {Automaton|null} The cached DFA configuration. */
export let dfa = null;
/** @type {Automaton|null} The cached Minimized DFA configuration. */
export let minimizedDfa = null;
/** @type {Automaton|null} The cached Complemented DFA configuration. */
export let complementedDfa = null;

/**
 * Wipes the entire application state. 
 * Used when generating a brand new automaton or importing a file to prevent stale memory leaks.
 * @returns {void}
 */
export function clearAllStates() {
    enfa = null;
    nfa = null;
    dfa = null;
    minimizedDfa = null;
    complementedDfa = null;
    automata = null;
}

/**
 * Updates the primary active automaton and logs the change.
 * Enforces strict immutability by deep cloning the incoming object.
 * @param {Automaton} newAutomata - The new automaton to set as active.
 * @returns {void}
 */
export function setAutomata(newAutomata) {
    automata = newAutomata ? JSON.parse(JSON.stringify(newAutomata)) : null;
    console.log("Automata updated:", automata);
}

/**
 * Sets the current e-NFA and clears downstream converted states to enforce data consistency.
 * @param {Automaton} newEnfa - The e-NFA object.
 * @returns {void}
 */
export function setEnfa(newEnfa) {
    enfa = newEnfa ? JSON.parse(JSON.stringify(newEnfa)) : null;
    nfa = null;
    dfa = null;
    minimizedDfa = null;
    complementedDfa = null;
    setAutomata(enfa);
    console.log("eNFA updated:", enfa);
}

/**
 * Sets the current NFA and clears downstream deterministic states.
 * @param {Automaton} newNfa - The NFA object.
 * @returns {void}
 */
export function setNfa(newNfa) {
    nfa = newNfa ? JSON.parse(JSON.stringify(newNfa)) : null;
    dfa = null;
    minimizedDfa = null;
    complementedDfa = null;
    setAutomata(nfa);
    console.log("NFA updated:", nfa);
}

/**
 * Sets the current DFA and clears downstream minimized/complemented states.
 * @param {Automaton} newDfa - The DFA object.
 * @returns {void}
 */
export function setDfa(newDfa) {
    dfa = newDfa ? JSON.parse(JSON.stringify(newDfa)) : null;
    minimizedDfa = null;
    complementedDfa = null;
    setAutomata(dfa);
    console.log("DFA updated:", dfa);
}

/**
 * Sets the minimized DFA state.
 * @param {Automaton} newMinimizedDfa - The minimized DFA object.
 * @returns {void}
 */
export function setMinimizedDfa(newMinimizedDfa) {
    minimizedDfa = newMinimizedDfa ? JSON.parse(JSON.stringify(newMinimizedDfa)) : null;
    setAutomata(minimizedDfa);
    console.log("Minimized DFA updated:", minimizedDfa);
}

/**
 * Sets the complemented DFA state.
 * @param {Automaton} newComplementedDfa - The complemented DFA object.
 * @returns {void}
 */
export function setComplementedDfa(newComplementedDfa) {
    complementedDfa = newComplementedDfa ? JSON.parse(JSON.stringify(newComplementedDfa)) : null;
    setAutomata(complementedDfa);
    console.log("Complemented DFA updated:", complementedDfa);
}
