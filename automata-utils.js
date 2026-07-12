/**
 * @fileoverview Data-structure utility functions for manipulating Automaton objects.
 */

/**
 * Middleware that sanitizes an automaton's state names before rendering.
 * Advanced conversions (like subset construction) generate massive compound state names 
 * (e.g., 'q0-q1-q2'). This function remaps them to a clean `q0, q1...` namespace 
 * for visual clarity, while maintaining mathematical structural integrity.
 * 
 * @param {import('./state.js').Automaton} automaton - The raw automaton to normalize.
 * @returns {import('./state.js').Automaton} A cloned automaton with sanitized state labels.
 */
export function normalizeAutomaton(automaton) {
    if (!automaton || !automaton.states || !automaton.states.some(s => s.includes('-') || s.includes(',') || s.length > 5)) {
        return automaton;
    }

    const stateMap = {};
    const newStates = automaton.states.map((state, index) => {
        const newState = `q${index}`;
        stateMap[state] = newState;
        return newState;
    });

    const newStart = stateMap[automaton.start] || automaton.start;
    const newAccept = (automaton.accept || []).map(s => stateMap[s] || s);
    const newTransitions = {};

    for (const from in automaton.transitions) {
        const newFrom = stateMap[from] || from;
        newTransitions[newFrom] = {};
        for (const sym in automaton.transitions[from]) {
            const targets = automaton.transitions[from][sym];
            if (Array.isArray(targets)) newTransitions[newFrom][sym] = targets.map(t => stateMap[t] || t);
            else if (targets) newTransitions[newFrom][sym] = stateMap[targets] || targets;
        }
    }

    return { ...automaton, states: newStates, start: newStart, accept: newAccept, transitions: newTransitions };
}

/**
 * Prepares a DFA by ensuring it has a Total Transition Function.
 * A "dead state" or "sink state" must be injected if any transitions are missing.
 *
 * @param {import('./state.js').Automaton} dfa - The input DFA.
 * @returns {import('./state.js').Automaton} A fully complete DFA safely traversable for all strings.
 */
export function completeDfa(dfa) {
    let sinkState = "deadState";
    // Ensure the injected state name doesn't collide with user-defined states
    while (dfa.states.includes(sinkState)) {
        sinkState += "_";
    }
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
 * Parses the custom TXT format into an automaton object.
 * The schema requires specific headers: TYPE, STATES, ALPHABET, START, ACCEPT, TRANSITIONS.
 * @param {string} text The text content of the file.
 * @returns {import('./state.js').Automaton} The parsed automaton.
 */
export function parseTxtToAutomaton(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    const data = {
        type: 'DFA',
        states: [],
        alphabet: [],
        start: '',
        accept: [],
        transitions: {}
    };

    let parsingTransitions = false;

    for (const line of lines) {
        if (line.toUpperCase() === 'TRANSITIONS:') {
            parsingTransitions = true;
            continue;
        }

        if (!parsingTransitions) {
            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) continue;

            const key = line.substring(0, colonIndex).trim().toUpperCase();
            const value = line.substring(colonIndex + 1).trim();

            if (key === 'TYPE') data.type = value;
            else if (key === 'STATES') data.states = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
            else if (key === 'ALPHABET') data.alphabet = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
            else if (key === 'START') data.start = value;
            else if (key === 'ACCEPT') data.accept = value ? value.split(',').map(s => s.trim()).filter(Boolean) : [];
        } else {
            const parts = line.split(/[\s,]+/).filter(Boolean);
            if (parts.length >= 3) {
                const from = parts[0];
                const sym = parts[1];
                const to = parts[2];

                if (!data.transitions[from]) data.transitions[from] = {};
                if (!data.transitions[from][sym]) data.transitions[from][sym] = [];
                
                if (!data.transitions[from][sym].includes(to)) {
                    data.transitions[from][sym].push(to);
                }
            }
        }
    }

    if (!data.type || data.states.length === 0 || data.alphabet.length === 0 || !data.start) {
        throw new Error("Invalid or incomplete TXT file structure.");
    }
    
    if (!['DFA', 'NFA', 'ENFA'].includes(data.type.toUpperCase())) {
        throw new Error(`Invalid Automaton TYPE: '${data.type}'. Must be DFA, NFA, or ENFA.`);
    }

    return data;
}