/**
 * @fileoverview Regular Expression Parsing utilities.
 * Implements the Shunting-yard algorithm to convert infix regex into postfix notation.
 */

/** Internal explicit concatenation operator (non-printable to avoid user input conflicts) */
export const CONCAT = '\x08';

/**
 * Safely peeks at the top element of an array stack.
 */
function peek(stack) {
    return stack.length > 0 ? stack[stack.length - 1] : null;
}

/**
 * Defines the operator precedence for regex parsing.
 * Kleene Star (*) > Concatenation (.) > Union (|)
 */
function getPrecedence(c) {
    switch (c) {
        case '|': return 1;
        case CONCAT: return 2;
        case '*': return 3;
        default: return 0;
    }
}

/**
 * Pre-processing step: Insert explicit concatenation operator ('.') 
 * because standard regex implicitly concatenates adjacent characters (e.g. 'ab' -> 'a.b').
 * @param {string} exp - The stripped raw regex string.
 * @returns {string[]} An array of tokens with explicit '.' operators inserted.
 */
function insertExplicitConcatOperator(exp) {
    let output = [];
    for (let i = 0; i < exp.length; i++) {
        let token = exp[i];
        output.push(token);
        if (token === '(' || token === '|') continue;
        if (i < exp.length - 1) {
            let lookahead = exp[i + 1];
            if (lookahead === '*' || lookahead === '|' || lookahead === ')') continue;
            output.push(CONCAT);
        }
    }
    return output;
}

/**
 * Converts infix RegEx to Postfix using Dijkstra's Shunting-yard algorithm.
 * 
 * @param {string} exp - The string expression.
 * @returns {string[]} The postfix token array (e.g. "a.b" -> ["a", "b", "."])
 */
export function toPostfix(exp) {
    let output = [];
    let stack = [];
    let formattedRegEx = insertExplicitConcatOperator(exp);

    for (let token of formattedRegEx) {
        if (token === CONCAT || token === '|' || token === '*') {
            while (stack.length && peek(stack) !== '(' && getPrecedence(peek(stack)) >= getPrecedence(token)) {
                output.push(stack.pop());
            }
            stack.push(token);
        } else if (token === '(') {
            stack.push(token);
        } else if (token === ')') {
            while (stack.length && peek(stack) !== '(') {
                output.push(stack.pop());
            }
            if (stack.length === 0) throw new Error("Invalid Regex: Mismatched parentheses.");
            stack.pop(); // Pop '('
        } else {
            output.push(token); // Operands
        }
    }
    while (stack.length) {
        const op = stack.pop();
        if (op === '(') throw new Error("Invalid Regex: Mismatched parentheses.");
        output.push(op);
    }
    return output;
}