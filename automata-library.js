/**
 * @fileoverview Application Entry Point and Global API exposure.
 * Bootstraps the application, intercepts/normalizes user inputs before processing, 
 * and binds essential controller functions to the global `window` object for HTML onclick bindings.
 */
import { 
    buildTransitionTable as _buildTransitionTable, 
    generateAutomata as _generateAutomata, 
    convertNfaToDfa, 
    minimizeDfa, 
    convertEnfaToNfa,
    showENFA,
    showNFA,
    showDFA,
    showMinimizedDFA,
    showComplementDFA,
    convertRegexToEnfa,
    convertAutomatonToRegex,
    complementRegexAction,
    complementDFAAction,
    switchView
} from './ui-controller.js';
import { resetRun, stepForward, stepBackward } from './runner-controller.js';
import { handleEquivalenceTest } from './equivalence-ui.js';

/**
 * Pre-processor that catches complex state inputs (like 'q0-q1' from user typos 
 * or direct manual entries) and mathematically normalizes them to a flat namespace ('q0').
 * This prevents layout breakage in the HTML tables and physics engine.
 * 
 * @returns {void} Mutates the HTML input elements directly.
 */
function normalizeStateNamesInDOM() {
    const statesInput = document.getElementById('statesInput');
    const startStateInput = document.getElementById('startStateInput');
    const acceptStatesInput = document.getElementById('acceptStatesInput');

    if (!statesInput) return;

    let states = statesInput.value.split(',').map(s => s.trim()).filter(Boolean);
    // Check if any state contains a hyphen or exceeds 5 characters in length
    if (!states.some(s => s.includes('-') || s.length > 5)) return;

    const stateMap = {};
    const newStates = states.map((state, index) => {
        const newState = `q${index}`;
        stateMap[state] = newState;
        return newState;
    });

    statesInput.value = newStates.join(',');

    if (startStateInput && startStateInput.value) {
        const currentStart = startStateInput.value.trim();
        if (stateMap[currentStart]) {
            startStateInput.value = stateMap[currentStart];
        }
    }

    if (acceptStatesInput && acceptStatesInput.value) {
        const currentAccept = acceptStatesInput.value.split(',').map(s => s.trim()).filter(Boolean);
        const newAccept = currentAccept.map(s => stateMap[s] || s);
        acceptStatesInput.value = newAccept.join(',');
    }

    // Update transition table input values if they exist so data isn't lost before rebuild
    const transitionTable = document.getElementById('transitionTable');
    if (transitionTable) {
        transitionTable.querySelectorAll('.checkbox-list').forEach(list => {
            if (stateMap[list.dataset.from]) list.dataset.from = stateMap[list.dataset.from];
            list.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                if (stateMap[cb.value]) cb.value = stateMap[cb.value];
                cb.nextSibling.textContent = " " + (stateMap[cb.value] || cb.value); // Update visible label
            });
        });
        transitionTable.querySelectorAll('.cell-input').forEach(sel => {
            if (stateMap[sel.dataset.from]) sel.dataset.from = stateMap[sel.dataset.from];
            Array.from(sel.options).forEach(opt => {
                if (stateMap[opt.value]) opt.value = stateMap[opt.value];
                opt.text = (stateMap[opt.value] || opt.value); // Update visible label
            });
        });
    }
}

/**
 * Intercepts the UI-triggered `buildTransitionTable` to enforce naming sanitization first.
 * @param {...any} args - Variable arguments passed from the UI event context.
 * @returns {void}
 */
function buildTransitionTable(...args) {
    normalizeStateNamesInDOM();
    return _buildTransitionTable.apply(this, args);
}

/**
 * Intercepts the UI-triggered `generateAutomata` to enforce naming sanitization first.
 * @param {...any} args - Variable arguments passed from the UI event context.
 * @returns {void}
 */
function generateAutomata(...args) {
    normalizeStateNamesInDOM();
    return _generateAutomata.apply(this, args);
}

// --- Global Assignments ---
// Vanilla JS modules scope variables to the module, meaning inline HTML event 
// handlers (e.g. `onclick="automataController.generateAutomata()"`) cannot natively see them.
// We attach these APIs to the global window object to bridge the gap.

window.automataController = {
    buildTransitionTable,
    generateAutomata,
    convertNfaToDfa,
    minimizeDfa,
    convertEnfaToNfa,
    resetRun,
    stepForward,
    stepBackward,
    convertRegexToEnfa,
    convertAutomatonToRegex,
    complementRegexAction,
    complementDFAAction
};

window.uiController = {
    showENFA,
    showNFA,
    showDFA,
    showMinimizedDFA,
    showComplementDFA,
    switchView
};

window.equivalenceController = {
    handleEquivalenceTest
};

document.addEventListener("DOMContentLoaded", () => {
    buildTransitionTable();
});
