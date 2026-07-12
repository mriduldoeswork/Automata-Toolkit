/**
 * @fileoverview File Input/Output Controllers.
 * Implements serializers/deserializers for custom custom `.txt` files 
 * alongside logic for capturing and exporting the D3 SVGs to images.
 */
import { automata, setEnfa, setNfa, setDfa, clearAllStates } from './state.js';
import { populateUIFromAutomaton } from './dom-manipulator.js';
import { generateAutomata, updateUIWithNewAutomata } from './ui-controller.js';
import { normalizeAutomaton, parseTxtToAutomaton } from './automata-utils.js';

import { regexToEnfa } from './regex-to-enfa.js'; // Import regexToEnfa

/**
 * Initialization hook to attach DOM event listeners for import/export controls.
 */
document.addEventListener("DOMContentLoaded", () => {
    const importBtn = document.getElementById("importBtn");
    const exportBtn = document.getElementById("exportBtn");
    const importFileInput = document.getElementById("importFileInput");
    const exportSvgBtn = document.getElementById("exportSvgBtn");
    const exportPngBtn = document.getElementById("exportPngBtn");

    // Update the file input to expect .txt files by default
    importFileInput.accept = ".txt,text/plain";

    // --- Event Listeners ---

    // 1. Forward the button click to the hidden file input
    importBtn.addEventListener("click", () => {
        importFileInput.click();
    });

    // 2. Listen for when the user selects a file
    importFileInput.addEventListener("change", handleFileImport);

    // 3. Listen for export clicks
    exportBtn.addEventListener("click", handleFileExport);

    // 4. Listen for SVG and PNG exports
    exportSvgBtn.addEventListener("click", exportSVG);
    exportPngBtn.addEventListener("click", exportPNG);
});

/**
 * Gathers the current state of the application from the UI.
 * @returns {object} The application state.
 */
function gatherApplicationState() {
    // If an automaton is active (e.g., after "Draw" or a conversion), it's the single source of truth.
    // This ensures that we export the currently displayed automaton, not potentially stale UI input values.
    if (automata) {
        return {
            type: automata.type,
            // Convert arrays back to comma-separated strings for consistency with UI inputs.
            states: automata.states.join(','),
            alphabet: automata.alphabet.join(','),
            startState: automata.start,
            acceptStates: automata.accept.join(','),
            transitions: automata.transitions
        };
    }

    // Fallback: If no automaton has been drawn, export the raw values from the UI.
    // In this case, transitions will be empty, which is an accurate representation.
    return {
        type: document.getElementById('typeSelector').value,
        states: document.getElementById('statesInput').value,
        alphabet: document.getElementById('alphabetInput').value,
        startState: document.getElementById('startStateInput').value,
        acceptStates: document.getElementById('acceptStatesInput').value,
        transitions: {}
    };
}

/**
 * Handles the mathematical Export functionality.
 * Gathers the current application state, serializes it into the custom `.txt` schema,
 * and triggers an automatic browser download.
 * 
 * @returns {void} Triggers a side-effect (file download) via a temporary DOM element.
 */
function handleFileExport() {
    try {
        const currentState = gatherApplicationState();

        let txtContent = `TYPE: ${currentState.type}\n`;
        txtContent += `STATES: ${currentState.states}\n`;
        txtContent += `ALPHABET: ${currentState.alphabet}\n`;
        txtContent += `START: ${currentState.startState}\n`;
        txtContent += `ACCEPT: ${currentState.acceptStates}\n`;
        txtContent += `TRANSITIONS:\n`;

        const transitions = currentState.transitions;
        for (const from in transitions) {
            for (const sym in transitions[from]) {
                const targets = transitions[from][sym];
                if (Array.isArray(targets)) {
                    targets.forEach(to => {
                        txtContent += `${from} ${sym} ${to}\n`;
                    });
                } else if (targets) {
                    txtContent += `${from} ${sym} ${targets}\n`;
                }
            }
        }

        const blob = new Blob([txtContent], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const downloadLink = document.createElement("a");
        downloadLink.href = url;
        downloadLink.download = `automata-${currentState.type.toLowerCase()}-${new Date().toISOString().slice(0,10)}.txt`;

        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);

        URL.revokeObjectURL(url);
    } catch (error) {
        console.error("Export failed:", error);
        alert("Could not export the automaton. Check the console for errors.");
    }
}

/**
 * Handles the Import functionality.
 * Reads the uploaded TXT file, parses it, and updates the UI.
 * @param {Event} event The file input change event.
 */
function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function (e) {
        try {
            const text = e.target.result;
            let importedAutomaton = null;
            let regexStringFromFile = null;
            let automatonError = null;
            let regexError = null;

            // Attempt to parse as an automaton first
            try {
                importedAutomaton = parseTxtToAutomaton(text);
            } catch (e) {
                automatonError = e;
            }

            // If automaton parsing failed, try parsing as a regex
            if (!importedAutomaton) {
                try {
                    importedAutomaton = regexToEnfa(text.trim());
                    regexStringFromFile = text.trim(); // Store the regex string if successful
                } catch (e) {
                    regexError = e;
                }
            }

            if (importedAutomaton) {
                importedAutomaton = normalizeAutomaton(importedAutomaton);
                if (regexStringFromFile) document.getElementById('regexInput').value = regexStringFromFile; // Populate regex input if from file

                clearAllStates(); // Prevent stale states from prior sessions mixing with imported data
                
                if (importedAutomaton.type === 'ENFA') {
                    setEnfa(importedAutomaton);
                } else if (importedAutomaton.type === 'NFA') {
                    setNfa(importedAutomaton);
                } else if (importedAutomaton.type === 'DFA') {
                    setDfa(importedAutomaton);
                }
                
                updateUIWithNewAutomata(importedAutomaton, "File imported successfully!");
            } else {
                throw new Error(`Could not parse file as a valid automaton or regular expression. ` +
                                `Automaton parsing error: "${automatonError ? automatonError.message : 'N/A'}". ` +
                                `Regex parsing error: "${regexError ? regexError.message : 'N/A'}".`);
            }
        } catch (error) {
            console.error("Import failed:", error);
            alert(`Import failed: ${error.message}`);
        } finally {
            // Clear the input value so the same file can be re-imported if needed.
            event.target.value = "";
        }
    };

    reader.readAsText(file);
}

/**
 * Extracts the SVG content and injects necessary CSS styles for standalone rendering.
 * @returns {string} The serialized SVG string.
 */
function getSvgStringWithStyles() {
    const svgNode = document.getElementById("svg");
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgNode);
    
    // Add XML namespaces if missing
    if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
        source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!source.match(/^<svg[^>]+"http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
        source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // Add CSS styles specifically for the automaton visualization
    const style = `
    <style>
        .state { fill: #fff; stroke: black; stroke-width: 2.5; }
        .state.active { fill: #ffeb3b; stroke: #f39c12; stroke-width: 4; }
        .final-inner { fill: none; stroke: black; stroke-width: 2; }
        .edge { stroke: black; stroke-width: 2; fill: none; }
        .edge-label { font-size: 14px; fill: black; }
        .edge.active { stroke: #f39c12; }
        .node-label { font-size: 14px; pointer-events: none; fill: black; }
        marker path { fill: black; }
        marker[id^="arrow-active"] path { fill: #f39c12; }
    </style>`;
    
    // Insert style block right after the opening <svg> tag
    source = source.replace(/^(<svg[^>]*>)/, `$1${style}`);
    return source;
}

/**
 * Exports the D3 automaton visualization as a standalone SVG file.
 * 
 * @returns {void} Triggers a side-effect (file download).
 */
function exportSVG() {
    const svgString = getSvgStringWithStyles();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    
    const downloadLink = document.createElement("a");
    downloadLink.href = url;
    downloadLink.download = "automaton.svg";
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
}

/**
 * Exports the D3 automaton visualization as a high-resolution PNG image.
 * Achieves this by drawing the serialized SVG onto a hidden HTML5 Canvas.
 * 
 * @returns {void} Triggers a side-effect (file download).
 */
function exportPNG() {
    const svgString = getSvgStringWithStyles();
    const svgNode = document.getElementById("svg");
    const width = parseInt(svgNode.getAttribute("width")) || 1000;
    const height = parseInt(svgNode.getAttribute("height")) || 800;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");

    const img = new Image();
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    img.onload = function() {
        // Fill background with white
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        
        // Draw SVG onto canvas
        ctx.drawImage(img, 0, 0);
        
        // Extract PNG data URL and trigger download
        const pngUrl = canvas.toDataURL("image/png");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = "automaton.png";
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
    };
    img.src = url;
}
