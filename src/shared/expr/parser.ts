// Tokens into a tree, by precedence, lowest first:
//
//   or      := and ('||' and)*
//   and     := equal ('&&' equal)*
//   equal   := compare (('==' | '!=' | '===' | '!==') compare)*
//   compare := sum (('<' | '<=' | '>' | '>=') sum)*
//   sum     := unary (('+' | '-') unary)*
//   unary   := ('!' | '-') unary | member
//   member  := primary ('.' 'length')*
//   primary := number | string | true | false | null | name | '(' or ')'
//
// Names are widgets' ids; `.length` is the only member there is.

import { ExprError, type Token, tokenize } from './lexer.ts';

export type BinaryOp = '==' | '!=' | '===' | '!==' | '<' | '<=' | '>' | '>=' | '+' | '-';

export type Expr =
  | { kind: 'literal'; value: string | number | boolean | null }
  | { kind: 'name'; name: string; at: number }
  | { kind: 'not'; arg: Expr }
  | { kind: 'negate'; arg: Expr }
  | { kind: 'length'; of: Expr; at: number }
  | { kind: 'binary'; op: BinaryOp; left: Expr; right: Expr }
  | { kind: 'logical'; op: '&&' | '||'; left: Expr; right: Expr };

const LEVELS: string[][] = [
  ['==', '!=', '===', '!=='],
  ['<', '<=', '>', '>='],
  ['+', '-'],
];
const LITERALS: Record<string, boolean | null> = { true: true, false: false, null: null };

/** The tree of a condition; an ExprError says where it's wrong. */
export function parse(src: string): Expr {
  const tokens = tokenize(src);
  let pos = 0;
  const peek = () => tokens[pos];
  const isOp = (t: Token, ...ops: string[]) => t.type === 'op' && ops.includes(t.value);
  const describe = (t: Token) => (t.type === 'end' ? 'the end' : t.type === 'string' ? `“'${t.value}'”` : `“${t.value}”`);

  function logical(op: '&&' | '||', next: () => Expr): Expr {
    let left = next();
    while (isOp(peek(), op)) {
      pos++;
      left = { kind: 'logical', op, left, right: next() };
    }
    return left;
  }
  const or = (): Expr => logical('||', and);
  const and = (): Expr => logical('&&', () => binary(0));

  function binary(level: number): Expr {
    if (level >= LEVELS.length) return unary();
    let left = binary(level + 1);
    while (isOp(peek(), ...LEVELS[level])) {
      const op = (peek() as { value: BinaryOp }).value;
      pos++;
      left = { kind: 'binary', op, left, right: binary(level + 1) };
    }
    return left;
  }

  function unary(): Expr {
    const t = peek();
    if (isOp(t, '!')) {
      pos++;
      return { kind: 'not', arg: unary() };
    }
    if (isOp(t, '-')) {
      pos++;
      return { kind: 'negate', arg: unary() };
    }
    return member();
  }

  function member(): Expr {
    let e = primary();
    while (isOp(peek(), '.')) {
      const dot = peek();
      pos++;
      const name = peek();
      if (name.type !== 'name' || name.value !== 'length') throw new ExprError('Only .length can follow a value.', name.type === 'end' ? dot.at : name.at);
      pos++;
      e = { kind: 'length', of: e, at: dot.at };
    }
    return e;
  }

  function primary(): Expr {
    const t = peek();
    pos++;
    if (t.type === 'number' || t.type === 'string') return { kind: 'literal', value: t.value };
    if (t.type === 'name') return Object.hasOwn(LITERALS, t.value) ? { kind: 'literal', value: LITERALS[t.value] } : { kind: 'name', name: t.value, at: t.at };
    if (isOp(t, '(')) {
      const inner = or();
      const close = peek();
      if (!isOp(close, ')')) throw new ExprError(`Expected “)” but found ${describe(close)}.`, close.at);
      pos++;
      return inner;
    }
    throw new ExprError(t.type === 'end' ? 'The condition ends too soon.' : `Unexpected ${describe(t)}.`, t.at);
  }

  if (peek().type === 'end') throw new ExprError('The condition is empty.', 0);
  const tree = or();
  const rest = peek();
  if (rest.type !== 'end') throw new ExprError(`Unexpected ${describe(rest)}.`, rest.at);
  return tree;
}

/** The widgets' ids a tree reads, each once. */
export function namesIn(e: Expr, out = new Set<string>()): Set<string> {
  switch (e.kind) {
    case 'name':
      out.add(e.name);
      break;
    case 'not':
    case 'negate':
      namesIn(e.arg, out);
      break;
    case 'length':
      namesIn(e.of, out);
      break;
    case 'binary':
    case 'logical':
      namesIn(e.left, out);
      namesIn(e.right, out);
      break;
  }
  return out;
}
