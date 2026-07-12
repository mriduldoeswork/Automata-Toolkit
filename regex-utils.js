/**
 * @fileoverview Mathematical simplifiers for Regular Expressions.
 * Used by state elimination algorithms to prevent regex combinatorial explosion.
 */

/**
 * Parses a regex string and splits it by top-level union operators (|).
 * 
 * @param {string} r - The regex fragment to parse.
 * @returns {string[]} An array of isolated mathematical terms.
 */
export function getUnionTerms(r) {
    const terms = [];
    let depth = 0;
    let current = '';
    for (let i = 0; i < r.length; i++) {
        const char = r[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        
        if (char === '|' && depth === 0) {
            terms.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    if (current) terms.push(current);
    return terms;
}

/**
 * Checks if a regex string is fully enclosed in a pair of valid parentheses.
 * 
 * @param {string} r - The regex string to check.
 * @returns {boolean} True if the entire expression acts as a single grouped block.
 */
export function isWrapped(r) {
    if (!r.startsWith('(') || !r.endsWith(')')) return false;
    let depth = 0;
    for (let i = 0; i < r.length - 1; i++) {
        if (r[i] === '(') depth++;
        else if (r[i] === ')') depth--;
        if (depth === 0) return false;
    }
    return depth === 1 && r[r.length - 1] === ')';
}

/**
 * Simplifies the Union (U) operation of two regex terms.
 */
export function simplifyUnion(r1, r2) {
    if (r1 === '∅') return r2;
    if (r2 === '∅') return r1;
    if (r1 === r2) return r1;
    
    const terms1 = getUnionTerms(r1);
    const terms2 = getUnionTerms(r2);
    
    const combined = [...new Set([...terms1, ...terms2])];
    return combined.join('|');
}

/**
 * Simplifies the Concatenation (.) operation of two regex terms.
 */
export function simplifyConcat(r1, r2) {
    if (r1 === '∅' || r2 === '∅') return '∅';
    if (r1 === '#') return r2;
    if (r2 === '#') return r1;
    
    const wrap1 = getUnionTerms(r1).length > 1 ? `(${r1})` : r1;
    const wrap2 = getUnionTerms(r2).length > 1 ? `(${r2})` : r2;
    
    return `${wrap1}${wrap2}`;
}

/**
 * Simplifies the Kleene Star (*) operation on a regex term.
 */
export function simplifyStar(r) {
    if (r === '∅' || r === '#') return '#';
    if (r.startsWith('(') && r.endsWith(')*')) {
        const inner = r.slice(1, -2);
        const withoutStar = inner.slice(0, -1);
        if (inner.endsWith('*') && (withoutStar.length === 1 || isWrapped(withoutStar))) return inner;
    }
    if (isWrapped(r)) {
        return r.slice(1, -1).length === 1 ? `${r.slice(1, -1)}*` : `${r}*`;
    }
    if (r.endsWith('*') && (r.slice(0, -1).length === 1 || isWrapped(r.slice(0, -1)))) return r;
    return r.length === 1 ? `${r}*` : `(${r})*`;
}