// A condition worked out against the widgets' values, as JavaScript would
// work out the same text with those values (== loose, + joining text,
// && and || giving one of their sides), but walking the tree: nothing is
// compiled, so it runs where eval can't.

import { ExprError } from './lexer.ts';
import { type Expr, namesIn, parse } from './parser.ts';

export type Scalar = string | number | boolean | null | undefined;
export type Scope = Readonly<Record<string, Scalar>>;

export const truthy = (v: Scalar): boolean => !!v;

/** `a == b` as JavaScript has it, for the values a widget can hold. */
export function looseEquals(a: Scalar, b: Scalar): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return (a ?? null) === (b ?? null);
  if (typeof a === typeof b) return a === b;
  return Number(a) === Number(b);
}

function compare(op: '<' | '<=' | '>' | '>=', a: Scalar, b: Scalar): boolean {
  const both = typeof a === 'string' && typeof b === 'string';
  const x = both ? a : Number(a);
  const y = both ? b : Number(b);
  switch (op) {
    case '<':
      return x < y;
    case '<=':
      return x <= y;
    case '>':
      return x > y;
    case '>=':
      return x >= y;
  }
}

/** The tree's value. A name that isn't in `scope` is an ExprError. */
export function evaluate(e: Expr, scope: Scope): Scalar {
  switch (e.kind) {
    case 'literal':
      return e.value;
    case 'name':
      if (!Object.hasOwn(scope, e.name)) throw new ExprError(`There’s no widget “${e.name}” with a value.`, e.at);
      return scope[e.name];
    case 'not':
      return !truthy(evaluate(e.arg, scope));
    case 'negate':
      return -Number(evaluate(e.arg, scope));
    case 'length': {
      const v = evaluate(e.of, scope);
      if (typeof v !== 'string') throw new ExprError(`.length is for text, not ${v === null ? 'null' : typeof v}.`, e.at);
      return v.length;
    }
    case 'logical': {
      const left = evaluate(e.left, scope);
      if (e.op === '&&') return truthy(left) ? evaluate(e.right, scope) : left;
      return truthy(left) ? left : evaluate(e.right, scope);
    }
    case 'binary': {
      const a = evaluate(e.left, scope);
      const b = evaluate(e.right, scope);
      switch (e.op) {
        case '+':
          return typeof a === 'string' || typeof b === 'string' ? String(a) + String(b) : Number(a) + Number(b);
        case '-':
          return Number(a) - Number(b);
        case '===':
          return a === b;
        case '!==':
          return a !== b;
        case '==':
          return looseEquals(a, b);
        case '!=':
          return !looseEquals(a, b);
        default:
          return compare(e.op, a, b);
      }
    }
  }
}

// Conditions are worked out on every change of every value: each text is
// read once.
const parsed = new Map<string, Expr | ExprError>();
function compiled(src: string): Expr | ExprError {
  let e = parsed.get(src);
  if (!e) {
    try {
      e = parse(src);
    } catch (err) {
      e = err instanceof ExprError ? err : new ExprError(String(err), 0);
    }
    if (parsed.size > 2000) parsed.clear();
    parsed.set(src, e);
  }
  return e;
}

/** Why a condition is wrong (a mistake in it, or a widget it names that
 * isn't there), or null when it's fine. `ids`: the widgets with values. */
export function conditionProblem(src: string, ids: Iterable<string>): string | null {
  if (!src.trim()) return null;
  const e = compiled(src);
  if (e instanceof ExprError) return e.message;
  const known = new Set(ids);
  for (const name of namesIn(e)) if (!known.has(name)) return `There’s no widget “${name}” with a value.`;
  return null;
}

/** Whether a condition holds: true when it's empty, and when it's wrong
 * (a mistake mustn't hide or disable what the user needs). */
export function holds(src: string, scope: Scope): boolean {
  if (!src.trim()) return true;
  const e = compiled(src);
  if (e instanceof ExprError) return true;
  try {
    return truthy(evaluate(e, scope));
  } catch {
    return true;
  }
}
