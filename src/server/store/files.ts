// Files written whole or not at all: a temporary file beside it, then a
// rename, so a crash or two windows saving at once never leave half a
// panel. Each write has its own temporary name, so two never share one.

import { randomBytes } from 'node:crypto';
import { readFile, rename, rm, writeFile } from 'node:fs/promises';

export async function writeAtomic(file: string, text: string): Promise<void> {
  const temp = `${file}.${randomBytes(4).toString('hex')}.tmp`;
  try {
    await writeFile(temp, text);
    await rename(temp, file);
  } catch (e) {
    await rm(temp, { force: true });
    throw e;
  }
}

/** A file's JSON, or undefined when there's no such file. A file that
 * isn't JSON throws a SyntaxError. */
export async function readJson(file: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw e;
  }
}
