/**
 * @fileoverview Logic for DFA Minimization using Partition Refinement 
 * (closely resembling Hopcroft's Algorithm). Minimization reduces the number 
 * of states in a DFA while accepting the exact same language.
 */
import { completeDfa } from './automata-utils.js';

/**
 * Main export to minimize a given DFA.
 * Executes in 4 phases: 
 * 1. Completing the DFA (ensuring total transition function).
 * 2. Removing unreachable states (via Depth-First Search).
 * 3. Partitioning states into equivalence classes.
 * 4. Constructing the new minimized DFA.
 *
 * @param {import('./state.js').Automaton} originalDfa - The DFA to minimize.
 * @returns {import('./state.js').Automaton} The optimal minimized DFA.
 */
export function minimizeDfa(originalDfa) {
    const dfa = completeDfa(originalDfa);
    const alphabet = dfa.alphabet;
    
    // Phase 1: Filter out mathematically unreachable states using DFS
    const reachable = new Set();
    const stack = [dfa.start];
    reachable.add(dfa.start);
    
    while (stack.length > 0) {
        const s = stack.pop();
        alphabet.forEach(char => {
            const targets = dfa.transitions[s][char] || [];
            targets.forEach(t => {
                if (!reachable.has(t)) {
                    reachable.add(t);
                    stack.push(t);
                }
            });
        });
    }

    const reachableStates = dfa.states.filter(s => reachable.has(s));

    // Phase 2: Initial Partitions. 
    // 0-Equivalence classes: Divide states into Accepting (F) and Non-Accepting (Q-F).
    let partitions = [];
    const acceptSet = reachableStates.filter(s => dfa.accept.includes(s));
    const nonAcceptSet = reachableStates.filter(s => !dfa.accept.includes(s));
    
    if (acceptSet.length > 0) partitions.push(acceptSet);
    if (nonAcceptSet.length > 0) partitions.push(nonAcceptSet);

    // Phase 3: Iterative Refinement (k-equivalence).
    // Continuously split partitions if their states transition into DIFFERENT partitions.
    let changed = true;
    while (changed) {
        changed = false;
        let nextPartitions = [];

        for (const group of partitions) {
            if (group.length <= 1) {
                nextPartitions.push(group);
                continue;
            }

            const subGroups = [];
            for (const state of group) {
                let foundGroup = false;
                for (const sub of subGroups) {
                    // Two states are equivalent if, for every symbol, they transition to states 
                    // that belong to the SAME partition.
                    const equivalent = alphabet.every(char => {
                        const targetA = dfa.transitions[state][char][0];
                        const targetB = dfa.transitions[sub[0]][char][0];
                        
                        const indexA = partitions.findIndex(p => p.includes(targetA));
                        const indexB = partitions.findIndex(p => p.includes(targetB));
                        return indexA === indexB;
                    });

                    if (equivalent) {
                        sub.push(state);
                        foundGroup = true;
                        break;
                    }
                }
                if (!foundGroup) {
                    subGroups.push([state]);
                }
            }

            if (subGroups.length > 1) {
                changed = true; // A partition was successfully split, we must loop again
            }
            nextPartitions.push(...subGroups);
        }
        partitions = nextPartitions;
    }

    // Phase 4: Construct the final minimal DFA using partition arrays as state names
    const newStates = partitions.map(p => p.join('-'));
    const newStartState = partitions.find(p => p.includes(dfa.start))?.join('-');
    const newAcceptStates = partitions.filter(p => p.some(s => dfa.accept.includes(s))).map(p => p.join('-'));
    const newTransitions = {};

    for (const group of partitions) {
        const representative = group[0];
        const groupName = group.join('-');
        newTransitions[groupName] = {};
        alphabet.forEach(char => {
            const target = dfa.transitions[representative][char][0];
            const targetGroup = partitions.find(p => p.includes(target))?.join('-');
            if (targetGroup) {
                newTransitions[groupName][char] = [targetGroup];
            }
        });
    }

    return {
        type: "DFA",
        states: newStates,
        alphabet: dfa.alphabet,
        start: newStartState,
        accept: newAcceptStates,
        transitions: newTransitions
    };
}
