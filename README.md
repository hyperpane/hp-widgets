# Widgets

Make your own tool panels on the canvas: buttons, fields and logs that run
your scripts. Widgets is a small form designer in a window: lay out
components on a grid, give them JavaScript and shell commands that run on
the server, and you have a Deploy panel, a release checklist or a "build
with these flags" button, made for your project and kept in it.

## Features

- **Two modes:** **View**, the panel working as a finished tool (every
  window opens in it), and **Dev**, where you lay it out. Switch in the
  window's toolbar.
- **15 components**, drawn as the app draws its own: Text (heading, title,
  body, muted, monospace), Button (primary, secondary, outline, ghost,
  danger), Input, Number, Textarea, Checkbox, Switch, Select, Radio, Slider,
  Progress, Badge (in six colors), Log, Divider, and Group (a titled box
  that holds others).
- **A designer on a grid:** click a component in the palette to add it
  where there's room, or drag it onto the canvas. Drag to move, pull a
  handle to resize, all snapping to an 8px grid; moving a Group moves
  what's in it.
- **An inspector** for the selected widget: its id, its label or text, its
  own settings (placeholder, options, default value, min, max and step,
  style), its place and size, when it shows and when it's enabled, and its
  script. With nothing selected: the panel's name and size, and its widgets.
- **Conditions:** "Visible when" and "Enabled when" take a small
  expression of widgets' values, such as `env == "prod" && confirm` or
  `branch.length > 0`, worked out as you type in View mode. A mistake is
  shown in the inspector, and the widget stays shown and enabled until
  it's fixed.
- **Scripts on the server:** a button's click, or a field's change, runs
  its JavaScript in Node on the server, with the panel's values, and with
  `run()` for shell commands in the project's folder. A command's output
  streams into a Log as it comes; the button shows it's busy; **Stop**
  ends the script and the commands it started.
- **Undo and redo** in Dev mode, and every change saved as you make it.
- **Share a panel:** export it as an `.hpw` file, and import one into any
  project.
- **Values out:** in nodes mode, the **Values** port sends every widget's
  value as JSON whenever one changes.

## How to use

1. Open it: **+** on the project, or right-click the canvas, then
   **Widgets**.
2. Choose **New panel** (or **Import .hpw**). The panel opens in View mode;
   switch to **Dev** in the toolbar.
3. Add components from the palette, place them, and set them up in the
   inspector. Give the ones scripts use a clear id (`env`, `deploy`,
   `out`).
4. Select a button and write its script under **On click**, for example:

   ```js
   ui.set('status', 'Deploying…');
   ui.clear('out');
   const r = await run(`./deploy.sh ${values.env}`, { log: 'out' });
   ui.set('status', r.code === 0 ? 'Deployed' : 'Failed');
   ```

5. Switch back to **View** and use it.

In Dev mode:

| Keys | What they do |
| --- | --- |
| Delete or Backspace | Remove the selected widget |
| ⌘D (Ctrl+D) | Duplicate it |
| Arrows | Move it a pixel; with Shift, a grid step (8px) |
| Escape | Select nothing |
| ⌘Z, ⇧⌘Z (Ctrl+Z, Ctrl+Shift+Z) | Undo, redo |

## Scripts

A script is the body of an async function, run in Node on the server when
its widget is clicked (a Button) or changed (the other inputs: an Input,
Number or Textarea when you leave it or press Enter; a choice as soon as
it's made; a Slider when you let go). It has:

| Name | What it is |
| --- | --- |
| `values` | Every widget's value when it happened, by id: `values.env` |
| `event` | `{ widget, type, value }`: which widget, `click` or `change`, its value |
| `ui.get(id)`, `ui.set(id, value)` | A widget's value now; set a field's value, a Text's or Badge's text, a Progress bar's percent |
| `ui.prop(id, name, value)` | Change `label`, `text`, `options`, `variant`, `placeholder`, `min`, `max`, `step`, `disabled` or `hidden` |
| `ui.log(id, text)`, `ui.clear(id)` | Add lines to a Log, or empty it (without an id: the panel's first Log) |
| `ui.toast(message, { error })` | A toast in the app |
| `await run(command, { log, env, cwd })` | A shell command in the project's folder (`sh -c`, or `cmd /d /s /c` on Windows): `{ code, output }`. Its lines go to the first Log, or `log: 'id'`, or nowhere with `log: false`; `env` adds variables, `cwd` is a folder from the project's |
| `await sleep(ms)` | A pause |
| `project` | `{ id, name, folder }` |
| `console.log`, `fetch`, `setTimeout` | As in Node; `console` writes to the first Log |

An error a script throws (or a command it can't start) shows in a toast
and in the first Log, with the line it was on.

`disabled` and `hidden` set by a script win over the widget's conditions
until you reset the values (↺ in the toolbar) or open the window again.

## Good to know

- **Scripts aren't sandboxed.** They run in the plugin's own Node process
  with your permissions, in a context of their own (no `require`, no
  `process`) so they can't trip over the plugin; that's for tidiness, not
  security. They're the project's own scripts, like its `package.json`
  scripts: import an `.hpw` only from someone you'd take a script from.
- **What runs is what's saved:** switching to View mode, or clicking,
  saves any edit waiting first.
- A script that runs 5 seconds before its first `await` is stopped. After
  an `await` nothing can stop a loop that never ends: it blocks the plugin
  until the server restarts it, so keep long work in `run()`.
- `run()` uses your login shell's `PATH`, so it finds what a terminal
  would (Homebrew, nvm). Colors are left out of a Log, and a line a
  progress bar redraws shows as its last state.
- A Log keeps its last 2000 lines.
- Panels are kept in the project, in `.hyperpane/widgets/<id>.json`:
  commit them and your team has them. Values typed in View mode aren't
  kept: each window starts from the defaults.
- Importing is strict: an `.hpw` has to say it's one (`"format":
  "hyperpane-widget"`, version 1). Components this version doesn't know
  are left out, sizes too big for the canvas are made to fit, and a toast
  says what changed.

## How it works

The window is the client part: it draws the panel, keeps its values,
works out the conditions (with its own small expression reader, since a
frame can't compile code), and runs the editor. The server part, next to
the project, keeps the panels as JSON files in the project's storage and
runs scripts with `node:vm`: a run is a subscription, and each thing the
script does to the window (a value set, a line logged) comes back as it
happens. Commands are started through the server's `spawn`, so they're
tracked and end with the server; Stop kills each one with what it started.

| Where | What it is |
| --- | --- |
| `src/shared/` | The panel and its widgets (`model/`: types, defaults, normalizing), conditions (`expr/`), and the `.hpw` file |
| `src/server/` | The store (`store/`), scripts and their commands (`runtime/`), export and import (`transfer/`) |
| `src/client/` | The window (`app/`), the canvas in each mode (`canvas/`), the components (`widgets/`, one registry), the inspector, the palette, View mode's values and runs (`runtime/`), and the editor's geometry (`lib/`) |
| `test/` | The tests: conditions, the model and `.hpw`, the store, running scripts, and the editor's geometry and state |

The `.hpw` file is JSON:

```json
{ "format": "hyperpane-widget", "version": 1, "panel": { "name": "Deploy", "width": 864, "height": 528, "widgets": [] } }
```

## Develop

    ./build.sh --test

## License

MIT, © 2026 Astralyx. See [LICENSE](LICENSE).
