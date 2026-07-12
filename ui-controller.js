/**
 * @fileoverview UI Controller connecting user interactions with core domain logic.
 * Handles the extraction of data from the view, coordination of state transitions, 
 * and updating the canvas and tape components after automaton conversions.
 */

import { automata, setAutomata, enfa, nfa, dfa, minimizedDfa, complementedDfa, setEnfa, setNfa, setDfa, setMinimizedDfa, setComplementedDfa, clearAllStates } from './state.js';
import { nfaToDfa } from './converter-logic.js';
import { minimizeDfa as minimizeDfaLogic } from './minimize-logic.js';
import { draw } from './draw-engine.js';
import { resetRun } from './runner-controller.js';
import { removeEpsilonTransitions } from './automata-logic.js';
import { list, buildTransitionTableUI, populateUIFromAutomaton, readTransitionsFromUI } from './dom-manipulator.js';
import { regexToEnfa } from './regex-to-enfa.js';
import { automataToRegex } from './automata-to-regex.js';
import { normalizeAutomaton, completeDfa } from './automata-utils.js';

/**
 * Dynamically attaches event listeners to the action buttons inside the 
 * generated transition table based on the active automaton type.
 * 
 * @param {string} type - The current automaton type ('ENFA', 'NFA', or 'DFA').
 * @returns {void}
 */
function attachTableButtonListeners(type) {
    document.getElementById('generateAutomataBtn').addEventListener('click', generateAutomata);
    document.getElementById('toRegexBtn').addEventListener('click', convertAutomatonToRegex);

    const convertBtn = document.getElementById('convertBtn');
    if (convertBtn) {
        if (type === "ENFA") {
            convertBtn.addEventListener('click', convertEnfaToNfa);
        } else if (type === "NFA") {
            convertBtn.addEventListener('click', convertNfaToDfa);
        }
    }

    const minimizeBtn = document.getElementById('minimizeBtn');
    if (minimizeBtn) {
        minimizeBtn.addEventListener('click', minimizeDfa);
    }
}

/**
 * Coordinates reading user definitions (states, alphabet) and dynamically building the input grid.
 * 
 * @returns {void}
 */
export function buildTransitionTable() {
    const type = document.getElementById("typeSelector").value;
    const states = list("statesInput");
    const alphabet = list("alphabetInput");
    buildTransitionTableUI(states, alphabet, type);
    attachTableButtonListeners(type);
}

/**
 * Extracts user inputs from the UI, constructs the foundational Automaton state,
 * caches it in the global state manager, and triggers the D3 rendering cycle.
 * @returns {void}
 */
export function generateAutomata() {
    const type = document.getElementById("typeSelector").value;
    const states = list("statesInput");
    const alphabet = list("alphabetInput");
    const transitions = readTransitionsFromUI(states, type);

    const newAutomata = {
        type,
        states,
        alphabet,
        start: document.getElementById("startStateInput").value.trim(),
        accept: list("acceptStatesInput"),
        transitions
    };

    // Clear upstream/downstream history for a fresh canvas
    clearAllStates();

    if (type === 'ENFA') {
        setEnfa(newAutomata);
    } else if (type === 'NFA') {
        setNfa(newAutomata);
    } else if (type === 'DFA') {
        setDfa(newAutomata);
    }
    setAutomata(newAutomata);

    draw();
    resetRun();
}

/**
 * Action handler: Converts the globally active e-NFA to an NFA.
 * Triggers normalization and a full UI refresh.
 * @returns {void}
 */
export function convertEnfaToNfa() {
    if (!enfa || enfa.type !== "ENFA") return;

    const nfaResult = removeEpsilonTransitions(enfa);
    const newAutomata = normalizeAutomaton({ ...nfaResult, type: 'NFA' });
    setNfa(newAutomata);
    updateUIWithNewAutomata(newAutomata, "E-NFA successfully converted to NFA!");
}

/**
 * Action handler: Converts the globally active NFA to a DFA using subset construction.
 * Triggers normalization and a full UI refresh.
 * @returns {void}
 */
export function convertNfaToDfa() {
    if (!nfa || nfa.type !== "NFA") return;

    const dfaResult = normalizeAutomaton(nfaToDfa(nfa));
    setDfa(dfaResult); // Set the normalized DFA
    updateUIWithNewAutomata(dfaResult, "NFA successfully converted to DFA!");
}

/**
 * Action handler: Minimizes the globally active DFA using partition refinement.
 * Triggers normalization and a full UI refresh.
 * @returns {void}
 */
export function minimizeDfa() {
    if (!dfa || dfa.type !== "DFA") return;

    const minimized = normalizeAutomaton(minimizeDfaLogic(dfa));
    setMinimizedDfa(minimized);
    updateUIWithNewAutomata(minimized, "DFA successfully minimized!");
}

/**
 * Action handler: Compiles the user's Regular Expression string into an e-NFA.
 * Wipes stale history to establish the new RegEx NFA as the root truth.
 * @returns {void}
 */
export function convertRegexToEnfa() {
    const regexInput = document.getElementById("regexInput");
    if (!regexInput || !regexInput.value.trim()) {
        alert("Please provide a valid regular expression.");
        return;
    }
    
    try {
        const enfaResult = normalizeAutomaton(regexToEnfa(regexInput.value.trim()));
        if (enfaResult) {
            clearAllStates(); // Wipe stale history for a fresh regex-based eNFA
            setEnfa(enfaResult);
            updateUIWithNewAutomata(enfaResult, "Regex successfully converted to eNFA!");
        }
    } catch (error) {
        console.error("Regex conversion failed:", error);
        alert("Failed to convert Regex. Please check your syntax.");
    }
}

/**
 * Action handler: Complements the user's Regular Expression.
 * Automates the pipeline: Regex -> e-NFA -> NFA -> DFA -> Min DFA -> Complement -> Regex.
 * @returns {void}
 */
export function complementRegexAction() {
    const regexInput = document.getElementById("regexInput");
    if (!regexInput || !regexInput.value.trim()) {
        alert("Please provide a valid regular expression.");
        return;
    }
    
    try {
        const regexStr = regexInput.value.trim();
        
        // Step 1: Regex to e-NFA
        const enfaRes = regexToEnfa(regexStr);
        if (!enfaRes) return;
        
        // Step 2: e-NFA to NFA
        const nfaRes = removeEpsilonTransitions(enfaRes);
        nfaRes.type = 'NFA';
        
        // Step 3: NFA to DFA
        const dfaRes = nfaToDfa(nfaRes);
        
        // Step 4: DFA to Min DFA
        let minDfaRes = minimizeDfaLogic(dfaRes);
        minDfaRes = normalizeAutomaton(minDfaRes);
        
        // Step 5: Complete and Complement
        const completedDfa = completeDfa(minDfaRes);
        const allStates = completedDfa.states;
        const currentAcceptStates = completedDfa.accept || [];
        const newAcceptStates = allStates.filter(state => !currentAcceptStates.includes(state));
        
        const compDfaRes = {
            ...completedDfa,
            accept: newAcceptStates
        };
        
        // Step 6: Complemented DFA to Regex
        const newRegexStr = automataToRegex(compDfaRes);
        
        // Step 7: UI & State Sync
        clearAllStates();
        setEnfa(enfaRes);
        setNfa(nfaRes);
        setDfa(dfaRes);
        setMinimizedDfa(minDfaRes);
        setComplementedDfa(compDfaRes);
        
        if (regexInput) {
            regexInput.value = newRegexStr;
        }
        updateUIWithNewAutomata(compDfaRes, `Regex successfully complemented! Generated Regex: ${newRegexStr}`);
        
    } catch (error) {
        console.error("Complement Regex failed:", error);
        alert("Failed to complement Regex. Check the console for more details.");
    }
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
    const allStates = completedDfa.states;
    const currentAcceptStates = completedDfa.accept || [];
    const newAcceptStates = allStates.filter(state => !currentAcceptStates.includes(state));
    
    const complementedDfaState = { ...completedDfa, accept: newAcceptStates };

    setComplementedDfa(complementedDfaState);
    updateUIWithNewAutomata(complementedDfaState, "Displaying Complement DFA.");
}

/**
 * Action handler: Derives a Regular Expression representing the currently active automaton.
 * Uses the GNFA State Elimination method and displays the synthesized string.
 * @returns {void}
 */
export function convertAutomatonToRegex() {
    if (!automata) {
        alert("Please generate or import an automaton first.");
        return;
    }

    try {
        const regexResult = automataToRegex(automata);
        document.getElementById("status").textContent = `Generated Regex: ${regexResult}`;
        
        // If there's an input form dedicated to regex, visually populate it.
        const regexInput = document.getElementById("regexInput");
        if (regexInput) {
            regexInput.value = regexResult;
        }
    } catch (error) {
        console.error("Regex generation failed:", error);
        alert("Failed to generate Regex. Check the console for more details.");
    }
}

/**
 * Global view-sync function. Updates all UI inputs, renders the table, triggers the D3 graph, 
 * and resets the tape simulator to match a newly provided automaton instance.
 * 
 * @param {import('./state.js').Automaton} newAutomata - The machine state to synchronize.
 * @param {string} message - A status message to present to the user.
 * @returns {void}
 */
export function updateUIWithNewAutomata(newAutomata, message) {
    setAutomata(newAutomata);
    populateUIFromAutomaton(newAutomata);
    attachTableButtonListeners(newAutomata.type);
    draw();
    resetRun();
    document.getElementById("status").textContent = message;
}

/**
 * Restores the Epsilon-NFA (e-NFA) view from the application state cache.
 * @returns {void}
 */
export function showENFA() {
    if (enfa) {
        updateUIWithNewAutomata(enfa, "Displaying eNFA.");
    } else {
        alert("No eNFA version available. Please generate or convert one first.");
    }
}

/**
 * Restores the NFA view from the application state cache.
 * @returns {void}
 */
export function showNFA() {
    if (nfa) {
        updateUIWithNewAutomata(nfa, "Displaying NFA.");
    } else {
        alert("No NFA version available. Please generate or convert one first.");
    }
}

/**
 * Restores the DFA view from the application state cache.
 * @returns {void}
 */
export function showDFA() {
    if (dfa) {
        updateUIWithNewAutomata(dfa, "Displaying DFA.");
    } else {
        alert("No DFA version available. Please generate or convert one first.");
    }
}

/**
 * Restores the Minimized DFA view from the application state cache.
 * @returns {void}
 */
export function showMinimizedDFA() {
    if (minimizedDfa) {
        updateUIWithNewAutomata(minimizedDfa, "Displaying Minimized DFA.");
    } else {
        alert("No Minimized DFA version available. Please generate one first.");
    }
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

/**
 * Toggles the main application layout between the standalone Workspace
 * and the side-by-side Equivalence Testing view.
 * 
 * @param {string} viewName - The target view ('workspace' or 'equivalence').
 * @returns {void}
 */
export function switchView(viewName) {
    const isWorkspace = viewName === 'workspace';
    const isEquivalence = viewName === 'equivalence';
    
    document.getElementById('workspace-view').style.display = isWorkspace ? 'grid' : 'none';
    document.getElementById('equivalence-view').style.display = isEquivalence ? 'block' : 'none';
    
    document.getElementById('nav-workspace').classList.toggle('active', isWorkspace);
    document.getElementById('nav-equivalence').classList.toggle('active', isEquivalence);
}
