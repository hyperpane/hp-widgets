// Conditions: "Visible when" and "Enabled when", worked out in the window
// without compiling code (lexer → parser → evaluate).

export { conditionProblem, evaluate, holds, looseEquals, type Scalar, type Scope, truthy } from './evaluate.ts';
export { ExprError, tokenize, type Token } from './lexer.ts';
export { type BinaryOp, type Expr, namesIn, parse } from './parser.ts';
