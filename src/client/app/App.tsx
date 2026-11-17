// Which view a window is: the chooser while it has no panel (its `panel`
// data is empty), else the panel it names. Opening one sets the window's
// data, so the window shows it again when the project opens next.

import { useData, useHost, useProject, useWindow } from '@hyperpane/sdk/client';
import { NodeMessage } from '@hyperpane/ui';
import { Chooser } from './Chooser.tsx';
import { PanelWindow } from './PanelWindow.tsx';

export function App() {
  const host = useHost();
  const project = useProject();
  const window = useWindow();
  const data = useData();
  const open = (id: string | null) => {
    host.win.setData('panel', id);
    if (!id) host.win.setTitle('Widgets');
  };

  if (!project) return <NodeMessage>Open a project to make panels in it</NodeMessage>;
  const id = data.panel;
  if (!id) return <Chooser project={project.id} onOpen={open} />;
  // Another panel is another window's worth of state: nothing carries over.
  return <PanelWindow key={id} id={id} project={project.id} window={window?.id ?? 0} onOpen={open} />;
}
