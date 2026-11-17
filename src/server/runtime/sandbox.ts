// A widget's script, run as the body of an async function in a context of
// its own (node:vm): it sees the names it's given (values, ui, run…) and
// JavaScript's own builtins, not the server part's module scope or
// `require`. This keeps scripts from tripping over the part's internals;
// it is NOT a security boundary (vm never is), which is fine: the scripts
// are the project's own, like its package.json scripts.

import vm from 'node:vm';

/** How long a script may run before its first `await`: past this, a loop
 * that never ends is stopped rather than freezing the part. (vm's timeout
 * covers only that first stretch; what runs after an await can't be cut
 * short from this thread.) */
export const SYNC_LIMIT_MS = 5000;

export class ScriptError extends Error {
  /** The script's line it was on (from 1), when known. */
  readonly line: number | null;
  constructor(message: string, line: number | null) {
    super(line ? `${message} (line ${line})` : message);
    this.name = 'ScriptError';
    this.line = line;
  }
}

/** The line of `filename` an error's stack names first. */
function lineIn(stack: unknown, filename: string): number | null {
  if (typeof stack !== 'string') return null;
  const at = stack.indexOf(`${filename}:`);
  if (at < 0) return null;
  const m = /^:(\d+)/.exec(stack.slice(at + filename.length));
  return m ? Number(m[1]) : null;
}

/** An error from a script, whichever realm it was made in (one made in the
 * script's context isn't `instanceof Error` here), as a ScriptError. */
export function scriptError(e: unknown, filename: string): ScriptError {
  if (e instanceof ScriptError) return e;
  const o = e as { name?: unknown; message?: unknown; stack?: unknown } | null;
  if (o && typeof o === 'object' && typeof o.message === 'string') {
    const name = typeof o.name === 'string' && o.name !== 'Error' ? `${o.name}: ` : '';
    const line = lineIn(o.stack, filename);
    // A syntax error's stack starts with the place, not a frame.
    return new ScriptError(`${name}${o.message}`, line);
  }
  return new ScriptError(`It threw ${typeof e === 'string' ? e : (JSON.stringify(e) ?? String(e))}.`, null);
}

/** Runs `code` as an async function's body with `globals` as its names, and
 * resolves with what it returns. Rejects with a ScriptError. */
export async function runScript(code: string, globals: Record<string, unknown>, filename: string): Promise<unknown> {
  // The function's first line is the wrapper's: lineOffset -1 makes the
  // script's own lines count from 1.
  const source = `(async () => {\n${code}\n})()`;
  let script: vm.Script;
  try {
    script = new vm.Script(source, { filename, lineOffset: -1 });
  } catch (e) {
    throw scriptError(e, filename);
  }
  const context = vm.createContext({ ...globals }, { name: filename });
  try {
    return await (script.runInContext(context, { timeout: SYNC_LIMIT_MS, displayErrors: false }) as Promise<unknown>);
  } catch (e) {
    const err = e as { code?: unknown };
    if (err && err.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT')
      throw new ScriptError(`It ran for ${SYNC_LIMIT_MS / 1000} s before its first await: a loop that never ends?`, null);
    throw scriptError(e, filename);
  }
}
