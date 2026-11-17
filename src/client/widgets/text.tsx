// What a panel says: a Text (a heading, a title, a line, a quiet note, or
// monospace) and a Badge (a status in a color). Their value is their text,
// which a script sets with ui.set('status', 'Deployed').

import { Badge, cn } from '@hyperpane/ui';
import { Tag, Type } from 'lucide-react';
import { TYPES } from '../../shared/index.ts';
import type { WidgetEntry } from './types.ts';

const TEXT_LOOKS: Record<string, string> = {
  heading: 'text-base font-semibold',
  title: 'text-sm font-medium',
  body: 'text-xs',
  muted: 'text-xs text-[var(--node-muted)]',
  mono: 'font-mono text-xs',
};

export const text: WidgetEntry = {
  type: 'text',
  title: 'Text',
  hint: 'A heading, a label or a note. Scripts change it with ui.set.',
  icon: Type,
  defaults: TYPES.text,
  fields: [
    { kind: 'text', prop: 'text', label: 'Text', multiline: true },
    { kind: 'variant', label: 'Style' },
  ],
  variantLabels: { body: 'Body', heading: 'Heading', title: 'Title', muted: 'Muted', mono: 'Monospace' },
  render: ({ props, value }) => (
    <div
      className={cn('flex h-full w-full items-center overflow-hidden break-words whitespace-pre-wrap', TEXT_LOOKS[props.variant ?? 'body'] ?? TEXT_LOOKS.body)}
    >
      {String(value ?? '')}
    </div>
  ),
};

/** A badge's variant is its color. */
const BADGE_COLORS = { neutral: 'neutral', green: 'green', amber: 'amber', rose: 'rose', blue: 'blue', violet: 'violet' } as const;

export const badge: WidgetEntry = {
  type: 'badge',
  title: 'Badge',
  hint: 'A status in a color: Ready, Deploying, Failed.',
  icon: Tag,
  defaults: TYPES.badge,
  fields: [
    { kind: 'text', prop: 'text', label: 'Text' },
    { kind: 'variant', label: 'Color' },
  ],
  variantLabels: { neutral: 'Neutral', green: 'Green', amber: 'Amber', rose: 'Rose', blue: 'Blue', violet: 'Violet' },
  render: ({ props, value }) => (
    <div className="flex h-full w-full items-center">
      <Badge
        color={BADGE_COLORS[(props.variant ?? 'neutral') as keyof typeof BADGE_COLORS] ?? 'neutral'}
        className="max-w-full gap-1.5"
        icon={<span aria-hidden className="size-1.5 flex-none rounded-full bg-current" />}
      >
        <span className="truncate">{String(value ?? '')}</span>
      </Badge>
    </div>
  ),
};
