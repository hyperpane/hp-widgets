// The client part: the Widgets window, one frame per window. React, the
// SDK, the UI kit, CodeMirror and Lucide come from the app; Tailwind
// classes are compiled for this plugin from what this folder uses.
//
//   app/        the window: the chooser, a panel's toolbar, View and Dev mode
//   canvas/     the panel drawn: at work (View) and in frames to edit (Dev)
//   widgets/    every type of widget: its name, icon, defaults, look, fields
//   inspector/  Dev mode's right side: the selected widget's or the panel's
//   palette/    Dev mode's left side: the types to add
//   runtime/    View mode's values, conditions, and scripts run on the server
//   lib/        the grid, ids, history and files, without a DOM (tested)

import { mount } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { App } from './app/App.tsx';

mount((host) =>
  host.view.type === 'node' && host.view.kind === 'panel' ? <App /> : <NodeMessage error>Widgets has no “{host.view.type}” view here.</NodeMessage>,
);
