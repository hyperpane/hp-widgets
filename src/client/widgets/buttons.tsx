// A Button: its script runs on a click, and while it runs the button shows
// it (a spinner) and takes no second click.

import { Button } from '@hyperpane/ui';
import { LoaderCircle, MousePointerClick } from 'lucide-react';
import { TYPES } from '../../shared/index.ts';
import type { WidgetEntry } from './types.ts';

type Look = { variant: 'default' | 'secondary' | 'outline' | 'ghost'; color: 'neutral' | 'destructive' };
const LOOKS: Record<string, Look> = {
  primary: { variant: 'default', color: 'neutral' },
  secondary: { variant: 'secondary', color: 'neutral' },
  outline: { variant: 'outline', color: 'neutral' },
  ghost: { variant: 'ghost', color: 'neutral' },
  danger: { variant: 'default', color: 'destructive' },
};

export const button: WidgetEntry = {
  type: 'button',
  title: 'Button',
  hint: 'Runs its script when it’s clicked.',
  icon: MousePointerClick,
  defaults: TYPES.button,
  fields: [
    { kind: 'text', prop: 'label', label: 'Label' },
    { kind: 'variant', label: 'Style' },
  ],
  variantLabels: { primary: 'Primary', secondary: 'Secondary', outline: 'Outline', ghost: 'Ghost', danger: 'Danger' },
  render: ({ props, disabled, busy, dev, click }) => {
    const look = LOOKS[props.variant ?? 'primary'] ?? LOOKS.primary;
    return (
      <Button
        variant={look.variant}
        color={look.color}
        size="sm"
        className="h-full w-full min-w-0"
        disabled={disabled || busy}
        aria-busy={busy || undefined}
        tabIndex={dev ? -1 : undefined}
        onClick={click}
      >
        {busy && <LoaderCircle className="animate-spin" />}
        <span className="truncate">{props.label}</span>
      </Button>
    );
  },
};
