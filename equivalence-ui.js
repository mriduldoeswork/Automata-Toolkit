/**
 * @fileoverview View-Controller for the Equivalence Testing feature.
 * Handles user inputs, parses distinct file/regex formats, executes the mathematical 
 * equivalence check, and renders the visual results (counter-examples or mappings).
 */
import { checkEquivalence } from './equivalence-logic.js';
import { parseTxtToAutomaton } from './automata-utils.js';
import { regexToEnfa } from './regex-to-enfa.js';
import { draw } from './draw-engine.js';

/**
 * Orchestrates the Equivalence Test execution from the UI.
 * Extracts user inputs, triggers the parsing logic, runs the Cartesian BFS, 
 * and pushes the result to the view.
 * @returns {Promise<void>} Async to handle file reading natively.
 */
export async function handleEquivalenceTest() {
    const inputTypeA = document.getElementById('equivTypeA').value;
    const inputTypeB = document.getElementById('equivTypeB').value;
    
    let autoA, autoB;
    
    try {
        autoA = await getAutomatonFromInput('A', inputTypeA);
        autoB = await getAutomatonFromInput('B', inputTypeB);
    } catch (err) {
        alert(`Error parsing inputs: ${err.message}`);
        return;
    }
    
    try {
        const result = checkEquivalence(autoA, autoB);
        displayEquivalenceResult(result);
    } catch (mathError) {
        console.error("Equivalence computation failed:", mathError);
        alert(`Mathematical computation error: Could not compare these languages. Ensure inputs are connected and valid. Details: ${mathError.message}`);
    }
}

/**
 * Dynamically routes the user input to the correct compilation engine.
 * Implements a smart fallback: if a .txt file is imported, it tries to parse it 
 * as a strict automaton structure. If that fails, it assumes it's a raw regex file.
 * 
 * @param {string} side - 'A' or 'B' to target specific DOM inputs.
 * @param {string} type - 'regex' or 'file' input mode.
 * @returns {Promise<import('./state.js').Automaton>} The standardized machine ready for testing.
 */
async function getAutomatonFromInput(side, type) {
    if (type === 'regex') {
        const regexStr = document.getElementById(`equivRegex${side}`).value;
        if (!regexStr) throw new Error(`Regex for Automaton ${side} is empty`);
        return regexToEnfa(regexStr.trim());
    } else if (type === 'file') { // This now handles both automaton and regex files
        const fileInput = document.getElementById(`equivFile${side}`);
        if (!fileInput.files || fileInput.files.length === 0) {
            throw new Error(`File for Automaton ${side} is missing`);
        }
        const text = await fileInput.files[0].text();
        if (!text.trim()) {
            throw new Error(`File for Automaton ${side} is empty`);
        }

        // Attempt to parse as an automaton first
        try {
            return parseTxtToAutomaton(text);
        } catch (automatonError) {
            // If parsing as automaton fails, try parsing as a regex
            try {
                return regexToEnfa(text.trim());
            } catch (regexError) {
                // If both fail, throw a combined error for better debugging
                throw new Error(`Could not parse file for Automaton ${side} as a valid automaton or regular expression. ` +
                                `Automaton parsing error: "${automatonError.message}". ` +
                                `Regex parsing error: "${regexError.message}".`);
            }
        }
    } else {
        throw new Error(`Unknown input type: ${type}`);
    }
}

/**
 * Binds the mathematical equivalence result to the DOM.
 * Mutates success/error banners, injects shortest-string counter examples, 
 * maps isomorphic states visually, and triggers D3 renders of the minimal comparisons.
 * 
 * @param {Object} result - The output object from `checkEquivalence`.
 * @returns {void}
 */
function displayEquivalenceResult(result) {
    const resultDiv = document.getElementById('equivResult');
    resultDiv.style.display = 'block';
    
    if (result.equivalent) {
        let html = `<h3 style="color: #28a745;">✅ Languages are Equivalent!</h3>`;
        if (result.isomorphismMap && Object.keys(result.isomorphismMap).length > 0) {
            html += `<p><b>Isomorphism Mapping (Min DFA):</b></p><div style="display: flex; flex-direction: column; gap: 5px; font-family: monospace; font-size: 18px; background: #f8f9fa; padding: 15px; border-radius: 5px; border: 1px solid #dee2e6; width: fit-content; margin: 0 auto; text-align: center;">`;
            for (const [stateA, stateB] of Object.entries(result.isomorphismMap)) {
                html += `<div>state ${stateA} ➔ state ${stateB}</div>`;
            }
            html += `</div>`;
        }
        resultDiv.innerHTML = html;
    } else {
        const acceptedBy = result.acceptedByA ? 'Automaton A' : 'Automaton B';
        const rejectedBy = result.acceptedByA ? 'Automaton B' : 'Automaton A';
        resultDiv.innerHTML = `<h3 style="color: #dc3545;">❌ Languages are NOT Equivalent</h3>
                               <p><b>Counter-example:</b> <code>${result.counterExample}</code></p>
                               <p>This string is <b>accepted</b> by ${acceptedBy} and <b>rejected</b> by ${rejectedBy}.</p>`;
    }

    const visualsDiv = document.getElementById('equivVisualizations');
    visualsDiv.style.display = 'block';
    draw(result.dfaA, 'equivSvgA');
    draw(result.dfaB, 'equivSvgB');
}