// A condition's text as tokens. Conditions ("Visible when", "Enabled
// when") are evaluated in the window, whose frame may not compile code
// (its CSP has no 'unsafe-eval'), so they're a small language of their
// own, read here and in parser.ts, and worked out in evaluate.ts.

export class ExprError extends Error {
  /** Where in the text it went wrong (a character's index). */
  readonly at: number;
  constructor(message: string, at: number) {
    super(message);
    this.name = 'ExprError';
    this.at = at;
  }
}

export type Token =
  | { type: 'number'; value: number; at: number }
  | { type: 'string'; value: string; at: number }
  | { type: 'name'; value: string; at: number }
  | { type: 'op'; value: string; at: number }
  | { type: 'end'; at: number };

/** Longest first, so `===` isn't read as `==` and `=`. */
const OPERATORS = ['===', '!==', '==', '!=', '<=', '>=', '&&', '||', '<', '>', '!', '+', '-', '(', ')', '.'];
const ESCAPES: Record<string, string> = { n: '\n', t: '\t', r: '\r', '0': '\0', '\\': '\\', "'": "'", '"': '"' };

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] ?? ''))) {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i))!;
      if (/[A-Za-z_$]/.test(src[i + m[0].length] ?? '')) throw new ExprError(`“${src.slice(i, i + m[0].length + 1)}” isn’t a number or a name.`, i);
      out.push({ type: 'number', value: Number(m[0]), at: i });
      i += m[0].length;
      continue;
    }
    if (/[A-Za-z_$]/.test(c)) {
      const m = /^[A-Za-z_$][A-Za-z0-9_$]*/.exec(src.slice(i))!;
      out.push({ type: 'name', value: m[0], at: i });
      i += m[0].length;
      continue;
    }
    if (c === '"' || c === "'") {
      const start = i;
      let value = '';
      i++;
      for (;;) {
        if (i >= src.length) throw new ExprError('This text has no closing quote.', start);
        const d = src[i];
        if (d === c) break;
        if (d === '\\') {
          const e = src[i + 1];
          if (e === undefined) throw new ExprError('This text has no closing quote.', start);
          value += ESCAPES[e] ?? e;
          i += 2;
          continue;
        }
        value += d;
        i++;
      }
      i++;
      out.push({ type: 'string', value, at: start });
      continue;
    }
    const op = OPERATORS.find((o) => src.startsWith(o, i));
    if (op) {
      out.push({ type: 'op', value: op, at: i });
      i += op.length;
      continue;
    }
    if (c === '=') throw new ExprError('Compare with == (a single = would set a value).', i);
    if (c === '&' || c === '|') throw new ExprError(`Use ${c}${c} for “${c === '&' ? 'and' : 'or'}”.`, i);
    throw new ExprError(`A condition can’t have “${c}”.`, i);
  }
  out.push({ type: 'end', at: src.length });
  return out;
}
