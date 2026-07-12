/**
 * @fileoverview Implements the State Elimination Algorithm to convert an automaton 
 * into a Regular Expression. Uses Generalized NFA (GNFA) concepts to systematically 
 * collapse states and build mathematical string equations.
 */
import { removeEpsilonTransitions } from './automata-logic.js';
import { nfaToDfa } from './converter-logic.js';
import { minimizeDfa } from './minimize-logic.js';
import { simplifyUnion, simplifyConcat, simplifyStar } from './regex-utils.js';

/**
 * Main export to convert an automaton to its mathematically equivalent Regular Expression.
 * Uses the GNFA State Elimination method.
 * 
 * @param {import('./state.js').Automaton} auto - The source automaton.
 * @returns {string|null} The synthesized Regular Expression string.
 */
export function automataToRegex(auto) {
    if (!auto) return null;

    // Phase 1: Normalize any given automaton down to a Minimal DFA.
    // This reduces the number of states dramatically, preventing combinatorial explosion
    // of massive, unwieldy regex strings during the state elimination loops.
    let current = auto;
    if (current.type === 'ENFA') {
        current = removeEpsilonTransitions(current);
        current.type = 'NFA';
    }
    if (current.type === 'NFA') {
        current = nfaToDfa(current);
        current.type = 'DFA';
    }
    const minDfa = minimizeDfa(current); // Always minimize it

    // Phase 2: GNFA Initialization
    // A GNFA requires a single dedicated Start state (no incoming edges)
    // and a single dedicated Accept state (no outgoing edges).
    const states = [...minDfa.states];
    const gnfa = {};

    const START = 'GNFA_START';
    const ACCEPT = 'GNFA_ACCEPT';
    const allStates = [START, ...states, ACCEPT];

    allStates.forEach(s => {
        gnfa[s] = {};
        allStates.forEach(t => gnfa[s][t] = '∅');
    });

    states.forEach(from => {
        if (minDfa.transitions[from]) {
            for (const sym in minDfa.transitions[from]) {
                const targets = minDfa.transitions[from][sym];
                const targetList = Array.isArray(targets) ? targets : [targets];
                targetList.forEach(to => {
                    gnfa[from][to] = simplifyUnion(gnfa[from][to], sym);
                });
            }
        }
    });

    // Connect the new GNFA_START to the original start state with epsilon (#)
    gnfa[START][minDfa.start] = '#';
    // Connect all original accept states to the new GNFA_ACCEPT with epsilon (#)
    minDfa.accept.forEach(acc => gnfa[acc][ACCEPT] = '#');

    // Phase 3: State Elimination Loop
    // Rip out states one by one. Re-route paths using the formula:
    // NewPath(p -> r) = OldPath(p -> r) U [ Path(p -> q) . Path(q -> q)* . Path(q -> r) ]
    let activeStates = [...allStates];
    states.forEach(q => {
        activeStates = activeStates.filter(s => s !== q);
        for (const p of activeStates) {
            for (const r of activeStates) {
                const R_pq = gnfa[p][q], R_qq = gnfa[q][q], R_qr = gnfa[q][r], R_pr = gnfa[p][r];
                if (R_pq !== '∅' && R_qr !== '∅') {
                    const path = simplifyConcat(simplifyConcat(R_pq, simplifyStar(R_qq)), R_qr);
                    gnfa[p][r] = simplifyUnion(R_pr, path);
                }
            }
        }
    });

    return gnfa[START][ACCEPT];
}