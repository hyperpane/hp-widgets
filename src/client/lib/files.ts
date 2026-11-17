// Files the person picks in the window (an .hpw to import, from an
// <input type="file">): read as text here, in the frame, and sent to the
// server part, which reads it strictly. No DOM types: `File` is read for
// its name, size and text only, so the tests can hand it a stand-in.

import { HPW_MAX_BYTES } from '../../shared/index.ts';

/** A picked file's text. Rejects with a message for the user. */
export async function readPicked(file: { name: string; size: number; text(): Promise<string> }): Promise<string> {
  if (file.size > HPW_MAX_BYTES) throw new Error(`“${file.name}” is too big to be a panel (over 5 MB).`);
  if (!/\.(hpw|json)$/i.test(file.name)) throw new Error(`“${file.name}” isn’t a .hpw file.`);
  return file.text();
}
