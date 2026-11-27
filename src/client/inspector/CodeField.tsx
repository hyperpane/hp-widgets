// A script's code: CodeMirror as the Editor sets it up (@hyperpane/code:
// the window's colors, its keys, find), with JavaScript's highlighting.
// What's typed goes into the panel as it's typed; a change from outside
// (Undo, another widget selected) replaces the text.

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, placeholder as placeholderText } from '@codemirror/view';
import { languageFor, setup } from '@hyperpane/code';
import { cn } from '@hyperpane/ui';

export function CodeField({
  value,
  onChange,
  placeholder,
  label,
  fontSize = 12,
  className,
}: {
  value: string;
  onChange(v: string): void;
  placeholder?: string;
  label: string;
  fontSize?: number;
  className?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const change = useRef(onChange);
  change.current = onChange;

  useEffect(() => {
    if (!box.current) return;
    const s = setup(
      {
        save: () => {},
        update: (u) => {
          if (u.docChanged) change.current(u.state.doc.toString());
        },
        toggleWrap: () => {},
      },
      { indent: { unit: '  ', tabSize: 2 }, wrap: true, looks: { fontSize, lineNumbers: true, activeLine: true } },
    );
    const v = new EditorView({
      parent: box.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          ...s.extensions,
          placeholder ? placeholderText(placeholder) : [],
          EditorView.contentAttributes.of({ 'aria-label': label }),
          EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
        ],
      }),
    });
    view.current = v;
    // JavaScript, loaded as the Editor loads a language: into its compartment.
    let live = true;
    void languageFor('script.js')
      ?.load()
      .then((lang) => live && v.dispatch({ effects: s.language.reconfigure(lang) }));
    return () => {
      live = false;
      v.destroy();
      view.current = null;
    };
    // The editor is made once; the text follows below.
  }, []);

  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  return (
    <div
      ref={box}
      className={cn(
        'rounded-control min-h-0 overflow-hidden border border-[var(--hairline-strong)] focus-within:border-[var(--node-accent)] [&_.cm-editor]:h-full [&_.cm-editor]:outline-none',
        className,
      )}
    />
  );
}
