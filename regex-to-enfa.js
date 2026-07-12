/**
 * @fileoverview Implements the compilation of standard Regular Expressions into Epsilon-NFAs (e-NFA).
 * Uses the Shunting-yard algorithm to parse the infix regex into postfix notation, 
 * followed by Thompson's Construction to build the final mathematical automaton graph.
 */

import { toPostfix, CONCAT } from './regex-parser.js';

/**
 * Main export to convert a regular expression string into an equivalent Epsilon-NFA.
 * 
 * @param {string} regex - The standard regular expression input (e.g., "(a|b)*abb").
 * @returns {import('./state.js').Automaton|null} The mathematically constructed e-NFA.
 * @throws {Error} If the regular expression is structurally invalid.
 */
export function regexToEnfa(regex) {
    if (!regex) return null;
    
    // Strip spaces to avoid alphabet confusion
    regex = regex.replace(/\s+/g, ''); 
    
    let stateCounter = 0;

    /**
     * Generates a monotonically increasing, unique state identifier.
     * @returns {string} e.g., "q0", "q1"
     */
    function nextState() {
        return `q${stateCounter++}`;
    }

    /**
     * Thompson's Construction: Base Case.
     * Creates a simple NFA that recognizes exactly one symbol: -> (S) --symbol--> ((A))
     * @param {string} symbol - The input character.
     * @returns {Object} A sub-automaton fragment.
     */
    function createBasicNFA(symbol) {
        const start = nextState();
        const accept = nextState();
        const transitions = {};
        transitions[start] = {};
        transitions[start][symbol] = [accept];
        transitions[accept] = {};
        return { start, accept, transitions, states: [start, accept] };
    }

    /**
     * Thompson's Construction: Concatenation (NFA1 . NFA2)
     * Links the accept state of NFA1 to the start state of NFA2 via an Epsilon transition.
     * @param {Object} nfa1 - The first sub-automaton.
     * @param {Object} nfa2 - The second sub-automaton.
     * @returns {Object} The combined sub-automaton fragment.
     */
    function applyConcat(nfa1, nfa2) {
        const transitions = { ...nfa1.transitions, ...nfa2.transitions };
        
        if (!transitions[nfa1.accept]) transitions[nfa1.accept] = {};
        if (!transitions[nfa1.accept]['#']) transitions[nfa1.accept]['#'] = [];
        transitions[nfa1.accept]['#'].push(nfa2.start); // Epsilon transition
        
        return {
            start: nfa1.start,
            accept: nfa2.accept,
            transitions,
            states: [...new Set([...nfa1.states, ...nfa2.states])]
        };
    }

    /**
     * Thompson's Construction: Union (NFA1 | NFA2)
     * Creates a new global Start state branching into both NFAs via Epsilon transitions,
     * and a new global Accept state where both NFAs converge via Epsilon transitions.
     * @param {Object} nfa1 - The first sub-automaton.
     * @param {Object} nfa2 - The second sub-automaton.
     * @returns {Object} The combined sub-automaton fragment.
     */
    function applyUnion(nfa1, nfa2) {
        const start = nextState();
        const accept = nextState();
        const transitions = { ...nfa1.transitions, ...nfa2.transitions };
        
        transitions[start] = { '#': [nfa1.start, nfa2.start] };
        transitions[accept] = {};
        
        if (!transitions[nfa1.accept]) transitions[nfa1.accept] = {};
        if (!transitions[nfa1.accept]['#']) transitions[nfa1.accept]['#'] = [];
        transitions[nfa1.accept]['#'].push(accept);
        
        if (!transitions[nfa2.accept]) transitions[nfa2.accept] = {};
        if (!transitions[nfa2.accept]['#']) transitions[nfa2.accept]['#'] = [];
        transitions[nfa2.accept]['#'].push(accept);
        
        return { start, accept, transitions, states: [start, accept, ...nfa1.states, ...nfa2.states] };
    }

    /**
     * Thompson's Construction: Kleene Star (NFA*)
     * Introduces a loop-back from the inner accept to the inner start state,
     * and a bypass from the new global start to the new global accept (handling 0 occurrences).
     * @param {Object} nfa - The sub-automaton to apply the Kleene Star to.
     * @returns {Object} The combined sub-automaton fragment.
     */
    function applyStar(nfa) {
        const start = nextState();
        const accept = nextState();
        const transitions = { ...nfa.transitions };
        
        transitions[start] = { '#': [nfa.start, accept] };
        transitions[accept] = {};
        
        if (!transitions[nfa.accept]) transitions[nfa.accept] = {};
        if (!transitions[nfa.accept]['#']) transitions[nfa.accept]['#'] = [];
        transitions[nfa.accept]['#'].push(nfa.start);
        transitions[nfa.accept]['#'].push(accept);
        
        return { start, accept, transitions, states: [start, accept, ...nfa.states] };
    }

    // --- Evaluation Execution ---
    // Read the postfix expression left to right. Operands form base NFAs; operators combine them.
    const postfix = toPostfix(regex);
    const stack = [];
    const alphabet = new Set();

    for (let token of postfix) {
        if (token === '*') {
            const nfa = stack.pop();
            if (!nfa) throw new Error("Invalid Regex: Mismatched operators.");
            stack.push(applyStar(nfa));
    } else if (token === CONCAT) {
            const nfa2 = stack.pop();
            const nfa1 = stack.pop();
            if (!nfa1 || !nfa2) throw new Error("Invalid Regex: Mismatched operators.");
            stack.push(applyConcat(nfa1, nfa2));
        } else if (token === '|') {
            const nfa2 = stack.pop();
            const nfa1 = stack.pop();
            if (!nfa1 || !nfa2) throw new Error("Invalid Regex: Mismatched operators.");
            stack.push(applyUnion(nfa1, nfa2));
        } else {
            if (token !== '#') alphabet.add(token);
            stack.push(createBasicNFA(token));
        }
    }

    if (stack.length !== 1) throw new Error("Invalid Regex: Could not resolve to a single finite automaton.");
    const finalNfa = stack.pop();

    // Map the internal representation to the application's global Automaton data contract
    return {
        type: 'ENFA',
        states: finalNfa.states,
        alphabet: Array.from(alphabet),
        start: finalNfa.start,
        accept: [finalNfa.accept],
        transitions: finalNfa.transitions
    };
}