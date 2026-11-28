// The back button in the window's header, which a panel's window owns: a
// page over the panel (a script's editor) closes first, else the window
// goes back to the chooser. A page says it's open with useBackPage.

import { useEffect, useRef } from 'react';

const pages: { current: () => void }[] = [];

/** While mounted, back closes this page (the last one opened). */
export function useBackPage(close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => {
    pages.push(latest);
    return () => {
      pages.splice(pages.indexOf(latest), 1);
    };
  }, []);
}

/** Closes the page on top, if one is open. */
export function closePage(): boolean {
  const top = pages.at(-1);
  if (!top) return false;
  top.current();
  return true;
}
