// Widgets' scripts (src/server/runtime), run through the `invoke`
// subscription as a window runs them: the ops they send, shell commands
// with their output in a Log, errors with their line, and Stop.

import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { invoke, stream, testHost } from '@hyperpane/sdk/testing';
import { widgets } from '../../src/server/plugin.ts';
import { plain, shellFor } from '../../src/server/runtime/processes.ts';
import { initialValues, newWidget, type Op, type Panel } from '../../src/shared/index.ts';

const folder = await mkdtemp(path.join(os.tmpdir(), 'widgets-run-'));
after(() => rm(folder, { recursive: true, force: true }));

const host = testHost({ id: 'widgets', projects: [{ id: 'p1', name: 'app', folder }] });
const plugin = widgets(host);
const windows = process.platform === 'win32';

/** A panel with a button running `script`, a field, a badge and two Logs. */
async function panelWith(script: string): Promise<Panel> {
  const panel = await invoke<Panel>(plugin, { op: 'create', project: 'p1', name: 'Run' });
  const go = newWidget('button', 'go', { x: 0, y: 0 });
  go.script = script;
  const name = newWidget('input', 'name', { x: 0, y: 40 });
  name.props.value = 'world';
  panel.widgets.push(
    go,
    name,
    newWidget('badge', 'status', { x: 0, y: 96 }),
    newWidget('log', 'out', { x: 0, y: 128 }),
    newWidget('log', 'other', { x: 0, y: 296 }),
  );
  await invoke(plugin, { op: 'save', project: 'p1', panel });
  return panel;
}

/** Clicks the button and collects the ops until `done`. */
async function click(panel: Panel, o: { window?: number; onOp?(op: Op): void } = {}): Promise<Op[]> {
  const s = stream<Op>(
    plugin,
    { op: 'invoke', project: 'p1', window: o.window ?? 1, panel: panel.id, widget: 'go', type: 'click', value: null, values: initialValues(panel.widgets) },
    { onEvent: o.onOp },
  );
  const reason = await s.end;
  assert.equal(reason, null, `it ended with ${reason}`);
  return s.events;
}

const done = (ops: Op[]) => ops.at(-1) as Extract<Op, { type: 'done' }>;

test('ui: get, set, prop, log, clear, toast, as ops in order', async () => {
  const panel = await panelWith(`
    ui.set('status', 'Hello ' + ui.get('name'));
    ui.prop('go', 'disabled', true);
    ui.prop('name', 'options', [1, 2]);
    ui.log('first');
    ui.log('other', 'to', 'the', 2, 'nd');
    ui.clear('other');
    console.log('via console', { a: 1 });
    ui.set('name', 42);
    if (ui.get('name') !== '42') throw new Error('ui.get should see ui.set');
    if (values.name !== 'world') throw new Error('values is the snapshot');
    if (event.widget !== 'go' || event.type !== 'click') throw new Error('event');
    if (project.folder !== ${JSON.stringify(folder)}) throw new Error('project');
    ui.toast('Done');
  `);
  const ops = await click(panel);
  assert.deepEqual(ops, [
    { type: 'set', id: 'status', value: 'Hello world' },
    { type: 'prop', id: 'go', name: 'disabled', value: true },
    { type: 'prop', id: 'name', name: 'options', value: ['1', '2'] },
    { type: 'log', id: 'out', text: 'first' },
    { type: 'log', id: 'other', text: 'to the 2 nd' },
    { type: 'clear', id: 'other' },
    { type: 'log', id: 'out', text: 'via console { a: 1 }' },
    { type: 'set', id: 'name', value: '42' },
    { type: 'toast', message: 'Done', error: false },
    { type: 'done', ok: true },
  ]);
});

test('mistakes are the run’s error, with the line they were on', async () => {
  const thrown = await click(await panelWith("ui.log('a');\n\nthrow new Error('Nope');"));
  assert.deepEqual(done(thrown), { type: 'done', ok: false, error: 'Nope (line 3)' });

  const unknown = await click(await panelWith("ui.set('ghost', 1)"));
  assert.match(done(unknown).error!, /^ui\.set: there’s no widget “ghost” in this panel\. \(line 1\)$/);

  const syntax = await click(await panelWith('let x = ;'));
  assert.match(done(syntax).error!, /^SyntaxError: Unexpected token ';' \(line 1\)$/);

  const button = await click(await panelWith("ui.set('go', 1)"));
  assert.match(done(button).error!, /a button has no value/);

  const prop = await click(await panelWith("ui.prop('go', 'colour', 'red')"));
  assert.match(done(prop).error!, /“colour” isn’t a prop/);
});

test('the script can’t reach the part’s own scope', async () => {
  const ops = await click(await panelWith('ui.log(typeof require, typeof process, typeof host, typeof run, typeof fetch)'));
  assert.deepEqual(ops[0], { type: 'log', id: 'out', text: 'undefined undefined undefined function function' });
});

test('run: a shell command in the project’s folder, its output in the first Log, its code and output back', async () => {
  const panel = await panelWith(`
    const r = await run('echo one && echo two', {});
    ui.set('status', 'code ' + r.code + ': ' + r.output.trim().split(/\\r?\\n/).join('|'));
    const where = await run(${JSON.stringify(windows ? 'cd' : 'pwd')}, { log: 'other' });
    ui.log('other', where.output.trim().endsWith(${JSON.stringify(path.basename(folder))}) ? 'here' : 'elsewhere: ' + where.output);
    const env = await run(${JSON.stringify(windows ? 'echo %GREETING%' : 'echo "$GREETING"')}, { log: false, env: { GREETING: 'hi' } });
    const failed = await run('exit 3', { log: false });
    ui.log('env ' + env.output.trim() + ', exit ' + failed.code);
  `);
  const ops = await click(panel);
  const logs = (id: string) => ops.filter((o): o is Extract<Op, { type: 'log' }> => o.type === 'log' && o.id === id).map((o) => o.text);
  assert.deepEqual(logs('out').join('\n').split(/\r?\n/), ['one', 'two', 'env hi, exit 3']);
  assert.ok(ops.some((o) => o.type === 'set' && o.value === 'code 0: one|two'));
  assert.equal(logs('other').at(-1), 'here');
  assert.deepEqual(done(ops), { type: 'done', ok: true });
});

test('Stop: a running command is killed and the run ends at once, cancelled', async () => {
  const panel = await panelWith(`
    ui.log('starting');
    await run(${JSON.stringify(windows ? 'ping -n 30 127.0.0.1' : 'sleep 30')});
    ui.log('never');
  `);
  const started = Date.now();
  const ops = await click(panel, {
    window: 9,
    onOp: (op) => {
      if (op.type === 'log' && op.text === 'starting') setTimeout(() => void invoke(plugin, { op: 'stop', project: 'p1', window: 9 }), 100);
    },
  });
  assert.ok(Date.now() - started < 5000, 'it ended well before the command would have');
  assert.deepEqual(done(ops), { type: 'done', ok: false, cancelled: true });
  assert.ok(!ops.some((o) => o.type === 'log' && o.text === 'never'));
});

test('Stop ends a sleep too, and a window closing stops its runs', async () => {
  const panel = await panelWith("await sleep(30000); ui.log('never');");
  const s = stream<Op>(plugin, { op: 'invoke', project: 'p1', window: 5, panel: panel.id, widget: 'go', type: 'click', value: null, values: {} });
  await new Promise((r) => setTimeout(r, 50));
  plugin.windowClosed?.('p1', 5);
  assert.equal(await s.end, null);
  assert.deepEqual(s.events, [{ type: 'done', ok: false, cancelled: true }]);
});

test('busy while a script runs', async () => {
  const panel = await panelWith('await sleep(100);');
  const running = click(panel);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(plugin.busy?.(), true);
  await running;
  assert.equal(plugin.busy?.(), false);
});

test('a widget with no script, or none to run, is done at once', async () => {
  const panel = await panelWith('');
  assert.deepEqual(await click(panel), [{ type: 'done', ok: true }]);
  await assert.rejects(
    stream(plugin, { op: 'invoke', project: 'p1', window: 1, panel: panel.id, widget: 'nope', type: 'click', values: {} }).end.then((e) => {
      throw new Error(e ?? '');
    }),
    /no widget “nope”/,
  );
});

test('shells and output lines', () => {
  assert.deepEqual(shellFor('echo hi', 'darwin'), { file: '/bin/sh', args: ['-c', 'echo hi'], verbatim: false });
  assert.deepEqual(shellFor('echo hi', 'win32').args, ['/d', '/s', '/c', '"echo hi"']);
  assert.equal(plain('\x1b[32mgreen\x1b[0m'), 'green');
  assert.equal(plain('10%\r50%\r100%'), '100%');
  assert.equal(plain('line\r'), 'line');
});
