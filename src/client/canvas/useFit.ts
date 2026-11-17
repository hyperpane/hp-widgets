// How much a panel is scaled down to fit where it's shown: never up, and
// never below `least` (smaller still, it scrolls). Follows the window as
// it's resized.

import { useLayoutEffect, useState } from 'react';

export function useFit(
  size: { width: number; height: number },
  { pad, least, height = true }: { pad: number; least: number; height?: boolean },
) {
  // A callback ref: the box may come and go (an empty panel has none).
  const [el, box] = useState<HTMLDivElement | null>(null);
  const [room, setRoom] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => setRoom({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const seen = new ResizeObserver(measure);
    seen.observe(el);
    return () => seen.disconnect();
  }, [el]);

  let scale = 1;
  if (room) {
    scale = Math.min(1, (room.w - pad * 2) / size.width);
    if (height) scale = Math.min(scale, (room.h - pad * 2) / size.height);
    scale = Math.max(least, scale);
  }
  return { box, scale };
}
