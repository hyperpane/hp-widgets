// Importing an .hpw file: an <input type="file"> in the frame (the person
// picks the file), its text read here and sent to the server part, which
// reads it strictly and adds it to the project as a new panel. What it had
// to change or leave out is said in a toast.

import { useRef } from 'react';
import { useHost } from '@hyperpane/sdk/client';
import { readPicked } from '../lib/files.ts';

export function useImport(project: string, onImported: (id: string) => void) {
  const host = useHost();
  const input = useRef<HTMLInputElement>(null);

  const take = async (file: File) => {
    try {
      const text = await readPicked(file);
      const r = await host.call<{ id: string; name: string; warnings: string[] }>('widgets', { op: 'import', project, text });
      if (r.warnings.length) {
        const more = r.warnings.length > 3 ? ` And ${r.warnings.length - 3} more.` : '';
        host.app.toast(`Imported “${r.name}”, with changes`, { description: `${r.warnings.slice(0, 3).join(' ')}${more}` });
      } else host.app.toast(`Imported “${r.name}”`);
      onImported(r.id);
    } catch (e) {
      host.app.toast(`Couldn’t import “${file.name}”`, { description: (e as Error).message, error: true });
    }
  };

  const element = (
    <input
      ref={input}
      type="file"
      accept=".hpw"
      hidden
      onChange={(e) => {
        const file = e.target.files?.[0];
        // Cleared, so picking the same file again is a change too.
        e.target.value = '';
        if (file) void take(file);
      }}
    />
  );
  return { element, open: () => input.current?.click() };
}
