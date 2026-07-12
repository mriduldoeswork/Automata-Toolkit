/**
 * @fileoverview Tape Simulation Engine.
 * Manages the step-by-step historical state tracking to allow users 
 * to time-travel (step forward/backward) through string evaluations.
 */
import { automata } from './state.js';
import { highlightStatesAndEdges } from './draw-engine.js';
import { getEpsilonClosure, getNextStates } from './automata-logic.js';

/** @type {Array<Object>} Linear history tracking the active states/edges at each step of the word. */
let history = [];
/** @type {number} The current active index in the input string. */
let currentIndex = 0;

/**
 * Re-initializes the tape simulation based on the currently active automaton and word input.
 * Pre-calculates the initial epsilon closure if viewing an e-NFA.
 * @returns {void} Mutates global tracking variables and refreshes the tape UI.
 */
export function resetRun() {
    if (!automata) return;

    const isEnfa = automata.type === "ENFA";
    const startState = [automata.start];
    const initialClosure = isEnfa ? getEpsilonClosure(startState, automata.transitions) : { states: new Set(startState), edges: new Set() };

    history = [{
        states: initialClosure.states,
        edges: initialClosure.edges,
        lastSymbol: null,
        isInitial: true
    }];
    currentIndex = 0;

    renderTape();
    updateView();
}

/**
 * Dynamically builds the interactive DOM tape representing the input string.
 * @returns {void}
 */
function renderTape() {
    const tapeContainer = document.getElementById("tape-container");
    const word = document.getElementById("wordInput").value;
    tapeContainer.innerHTML = "";

    word.split("").forEach((char, index) => {
        const cell = document.createElement("div");
        cell.className = "tape-cell";
        cell.textContent = char;
        cell.id = `tape-char-${index}`;
        tapeContainer.appendChild(cell);
    });
}

/**
 * Adjusts CSS classes on individual tape cells to visually indicate the playhead position.
 * @returns {void}
 */
function updateTapeHighlight() {
    const word = document.getElementById("wordInput").value;

    for (let i = 0; i < word.length; i++) {
        const cell = document.getElementById(`tape-char-${i}`);
        if (!cell) continue;

        cell.classList.remove("next-to-read", "just-read", "processed");

        if (i < currentIndex - 1) {
            cell.classList.add("processed");
        } else if (i === currentIndex - 1) {
            cell.classList.add("just-read");
        }

        if (i === currentIndex) {
            cell.classList.add("next-to-read");
        }
    }
}

/**
 * Advances the simulation by one symbol.
 * Fetches the next mathematical states based on transitions and epsilon closures, 
 * pushing the new data onto the `history` stack.
 * @returns {void}
 */
export function stepForward() {
    const word = document.getElementById("wordInput").value;
    if (currentIndex >= word.length) return;

    const currentStates = history[currentIndex].states;
    const symbol = word[currentIndex];
    
    const isEnfa = automata.type === "ENFA";
    const { states: nextStates, edges: edgesTaken } = getNextStates(currentStates, symbol, automata.transitions, isEnfa);

    history.push({
        states: nextStates,
        edges: edgesTaken,
        lastSymbol: symbol,
        isInitial: false
    });
    currentIndex++;
    updateView();
}

/**
 * Reverts the simulation by one symbol.
 * Pops the last state off the history stack to "time-travel" backward.
 * @returns {void}
 */
export function stepBackward() {
    if (currentIndex <= 0) return;
    history.pop();
    currentIndex--;
    const currentData = history[currentIndex];
    updateView();
}

/**
 * Synchronizes the visual engines with the current point in history.
 * Triggers the D3 SVG edge highlighting and updates the tape DOM indicators.
 * Resolves if the machine is currently in an Accept or Reject state at the end of the tape.
 * @returns {void}
 */
function updateView() {
    const currentData = history[currentIndex];

    highlightStatesAndEdges(
        currentData.states,
        currentData.edges,
        currentData.isInitial
    );

    updateTapeHighlight();

    const word = document.getElementById("wordInput").value;
    const isFinal = currentIndex === word.length;
    const isAccepted = Array.from(currentData.states).some(s =>
        automata.accept.includes(s)
    );

    let statusMsg = `Step ${currentIndex}: {${Array.from(currentData.states).join(", ")}}`;

    if (currentData.lastSymbol !== null) {
        statusMsg = `Read '${currentData.lastSymbol}' | ` + statusMsg;
    }

    if (isFinal) {
        statusMsg += isAccepted ? " ✅ ACCEPTED" : " ❌ REJECTED";
    } else {
        const nextSymbol = word[currentIndex];
        statusMsg += ` | Next: '${nextSymbol}'`;
    }

    document.getElementById("status").textContent = statusMsg;
}