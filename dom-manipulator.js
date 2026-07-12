/**
 * @fileoverview DOM Manipulation and View Layer.
 * Handles reading user inputs from the UI and dynamically generating 
 * the interactive HTML transition tables based on the selected automaton type.
 */

/**
 * Helper to parse comma-separated strings from an input field into sanitized arrays.
 * @param {string} id - The ID of the HTML input element.
 * @returns {string[]} An array of trimmed, non-empty string values.
 */
export const list = (id) => document.getElementById(id).value.split(",").map(s => s.trim()).filter(s => s);

/**
 * Reads the transition logic mapped by the user directly from the dynamically generated HTML table.
 * 
 * @param {string[]} states - Array of all defined states.
 * @param {string} type - The automaton type ('DFA', 'NFA', or 'ENFA').
 * @returns {Object} The compiled transition mapping matching the Automaton data contract.
 */
export function readTransitionsFromUI(states, type) {
    const transitions = {};
    states.forEach(s => transitions[s] = {});
    const isNFAFamily = (type === "NFA" || type === "ENFA");

    if (isNFAFamily) {
        // NFAs use Checkboxes (allow multiple target states per symbol)
        document.querySelectorAll(".checkbox-list").forEach(container => {
            const from = container.dataset.from;
            const sym = container.dataset.sym;
            const selected = Array.from(container.querySelectorAll("input:checked")).map(cb => cb.value);
            if (!transitions[from]) transitions[from] = {};
            transitions[from][sym] = selected;
        });
    } else { // DFA
        // DFAs use Select Dropdowns (strictly one target state per symbol)
        document.querySelectorAll(".cell-input").forEach(sel => {
            const from = sel.dataset.from;
            const sym = sel.dataset.sym;
            const val = sel.value;
            if (!transitions[from]) transitions[from] = {};
            transitions[from][sym] = val ? [val] : [];
        });
    }
    return transitions;
}

/**
 * Dynamically builds the interactive HTML Transition Input Table based on the defined states/alphabet.
 * Appends action buttons specific to the generated machine type (e.g., "Convert to DFA").
 * 
 * @param {string[]} states - The states to generate rows for.
 * @param {string[]} alphabet - The input symbols to generate columns for.
 * @param {string} type - The automaton type determining input styles (Checkboxes vs Dropdowns).
 * @returns {void} Mutates the #transitionTable DOM element.
 */
export function buildTransitionTableUI(states, alphabet, type) {
    const isNFAFamily = (type === "NFA" || type === "ENFA");
    // For e-NFA, inject epsilon ('#') as an explicit column in the UI table
    const displayAlphabet = type === "ENFA" ? Array.from(new Set([...alphabet, "#"])) : alphabet;

    let html = "<table><tr><th>State</th>";
    displayAlphabet.forEach(a => html += `<th>${a}</th>`);
    html += "</tr>";

    states.forEach(s => {
        html += `<tr><td><strong>${s}</strong></td>`;
        displayAlphabet.forEach(a => {
            html += `<td>`;
            if (isNFAFamily) {
                html += `<div class="checkbox-list" data-from="${s}" data-sym="${a}">`;
                states.forEach(t => {
                    html += `
                        <label class="checkbox-item">
                            <input type="checkbox" value="${t}"> ${t}
                        </label>`;
                });
                html += `</div>`;
            } else { // DFA
                html += `
                    <select class="cell-input" data-from="${s}" data-sym="${a}">
                        <option value="">--</option>
                        ${states.map(t => `<option value="${t}">${t}</option>`).join("")}
                    </select>`;
            }
            html += `</td>`;
        });
        html += "</tr>";
    });

    html += "</table><br>";
    
    html += `<div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button id="generateAutomataBtn">Draw Automata</button>`;
    
    if (type === "ENFA") {
        html += `<button id="convertBtn" style="background-color: #28a745;">Convert to NFA</button>`;
    } else if (type === "NFA") {
        html += `<button id="convertBtn" style="background-color: #28a745;">Convert to DFA</button>`;
    } else { // DFA
        html += `<button id="minimizeBtn" style="background-color: #6f42c1;">Minimize DFA</button>`;
    }
    
    html += `<button id="toRegexBtn" style="background-color: #17a2b8;">Convert to Regex</button>`;
    html += `<button id="complementBtn" style="background-color: #e83e8c;" onclick="automataController.complementDFAAction()">Complement DFA</button>`;

    html += `</div>`;

    document.getElementById("transitionTable").innerHTML = html;
}

/**
 * Re-populates all left-panel UI inputs and the transition table based on an existing Automaton object.
 * This is heavily utilized when switching views (e.g., clicking the "View Complemented DFA" button).
 * 
 * @param {import('./state.js').Automaton} automaton - The automaton data to bind to the UI.
 * @returns {void} Mutates input values and DOM selections.
 */
export function populateUIFromAutomaton(automaton) {
    document.getElementById("typeSelector").value = automaton.type;
    document.getElementById("statesInput").value = automaton.states.join(", ");
    document.getElementById("alphabetInput").value = automaton.alphabet.join(", ");
    document.getElementById("startStateInput").value = automaton.start;
    document.getElementById("acceptStatesInput").value = automaton.accept.join(", ");

    buildTransitionTableUI(automaton.states, automaton.alphabet, automaton.type);

    const isNFAFamily = automaton.type === 'NFA' || automaton.type === 'ENFA';

    if (isNFAFamily) {
        document.querySelectorAll(".checkbox-list").forEach(container => {
            const from = container.dataset.from;
            const sym = container.dataset.sym;
            const targets = (automaton.transitions[from] && automaton.transitions[from][sym]) || [];
            container.querySelectorAll("input").forEach(cb => {
                if (targets.includes(cb.value)) {
                    cb.checked = true;
                }
            });
        });
    } else { // DFA
        document.querySelectorAll(".cell-input").forEach(sel => {
            const from = sel.dataset.from;
            const sym = sel.dataset.sym;
            if (automaton.transitions[from] && automaton.transitions[from][sym]) {
                const target = automaton.transitions[from][sym] || [];
                sel.value = target[0] || "";
            }
        });
    }
}
