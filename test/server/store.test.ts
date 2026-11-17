// The project's panels (src/server/store), through the part's calls on a
// test host: kept as JSON files in the project, listed, renamed, copied,
// deleted, told to watchers; and .hpw files out and in.

import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { invoke, readAll, stream, testHost } from '@hyperpane/sdk/testing';
import { widgets } from '../../src/server/plugin.ts';
import { fromHpw, newWidget, type Panel, type PanelSummary, toHpw } from '../../src/shared/index.ts';

const folder = await mkdtemp(path.join(os.tmpdir(), 'widgets-store-'));
after(() => rm(folder, { recursive: true, force: true }));

const host = testHost({ id: 'widgets', projects: [{ id: 'p1', name: 'app', folder }] });
const plugin = widgets(host);
const storage = path.join(folder, '.hyperpane', 'widgets');
const call = <T>(request: Record<string, unknown>) => invoke<T>(plugin, { project: 'p1', ...request });

test('creates, saves, loads and lists panels, a JSON file each', async () => {
  const a = await call<Panel>({ op: 'create', name: 'Deploy' });
  assert.equal(a.name, 'Deploy');
  assert.equal(a.widgets.length, 0);
  const b = await call<Panel>({ op: 'create', name: 'Deploy' });
  assert.equal(b.name, 'Deploy 2', 'names are kept unique');

  a.widgets.push(newWidget('button', 'go', { x: 10, y: 13 }));
  a.widgets[0].script = "ui.toast('hi')";
  const saved = await call<{ id: string; warnings: string[] }>({ op: 'save', panel: a });
  assert.deepEqual(saved, { id: a.id, warnings: [] });

  const onDisk = JSON.parse(await readFile(path.join(storage, `${a.id}.json`), 'utf8'));
  assert.equal(onDisk.widgets[0].script, "ui.toast('hi')");
  assert.deepEqual(await call({ op: 'load', id: a.id }), a);

  const list = await call<PanelSummary[]>({ op: 'list' });
  assert.deepEqual(
    list.map((p) => [p.name, p.widgets]),
    [
      ['Deploy', 1],
      ['Deploy 2', 0],
    ],
  );
});

test('renames, duplicates and deletes', async () => {
  const p = await call<Panel>({ op: 'create', name: 'Tools' });
  const renamed = await call<Panel>({ op: 'rename', id: p.id, name: 'Deploy' });
  assert.equal(renamed.name, 'Deploy 3', 'Deploy and Deploy 2 are taken');
  const copy = await call<Panel>({ op: 'duplicate', id: p.id });
  assert.notEqual(copy.id, p.id);
  assert.equal(copy.name, 'Deploy 3 copy');
  await call({ op: 'delete', id: copy.id });
  await assert.rejects(call({ op: 'load', id: copy.id }), /isn’t in the project any more/);
  assert.ok(!(await readdir(storage)).includes(`${copy.id}.json`));
});

test('a file edited by hand is read sound; one that isn’t a panel is left out of the list', async () => {
  await writeFile(
    path.join(storage, 'by-hand.json'),
    JSON.stringify({
      name: 'By hand',
      widgets: [
        { id: 'x', type: 'warp-drive' },
        { id: 'ok', type: 'text' },
      ],
    }),
  );
  await writeFile(path.join(storage, 'broken.json'), '{ nope');
  const loaded = await call<Panel>({ op: 'load', id: 'by-hand' });
  assert.equal(loaded.id, 'by-hand');
  assert.deepEqual(
    loaded.widgets.map((w) => w.id),
    ['ok'],
  );
  const names = (await call<PanelSummary[]>({ op: 'list' })).map((p) => p.name);
  assert.ok(names.includes('By hand'));
  assert.ok(host.logs.some((l) => l.includes('broken.json')));
  await assert.rejects(call({ op: 'load', id: 'broken' }), /isn’t JSON/);
});

test('refuses ids that aren’t a panel’s (never a path) and calls without a project', async () => {
  await assert.rejects(call({ op: 'load', id: '../../etc/passwd' }), /isn’t a panel’s id/);
  await assert.rejects(call({ op: 'save', panel: { id: '../x', name: 'x' } }), /isn’t a panel’s id/);
  await assert.rejects(invoke(plugin, { op: 'list' }), /Open a project/);
});

test('watchers hear saves (with who saved) and deletes; the list again on each change', async () => {
  const p = await call<Panel>({ op: 'create', name: 'Watched' });
  const watch = stream<{ panel: Panel | null; by: number | null }>(plugin, { op: 'watch', project: 'p1', id: p.id });
  const list = stream<PanelSummary[]>(plugin, { op: 'panels', project: 'p1' });
  assert.ok((await list.next()).some((x) => x.id === p.id));

  await call({ op: 'save', panel: { ...p, name: 'Watched now' }, window: 7 });
  const heard = await watch.next();
  assert.equal(heard.panel?.name, 'Watched now');
  assert.equal(heard.by, 7);
  assert.ok((await list.next()).some((x) => x.name === 'Watched now'));

  await call({ op: 'delete', id: p.id });
  assert.equal((await watch.next()).panel, null);
  watch.cancel();
  list.cancel();
});

test('export answers with the .hpw as a stream; import adds it as a new panel', async () => {
  const p = await call<Panel>({ op: 'create', name: 'Shipping' });
  p.widgets.push(newWidget('log', 'out', { x: 0, y: 0 }));
  await call({ op: 'save', panel: p });

  const out = await call<{ name: string; size: number; data: ReadableStream<Uint8Array> }>({ op: 'export', id: p.id });
  assert.equal(out.name, 'Shipping.hpw');
  const text = new TextDecoder().decode(await readAll(out.data));
  assert.equal(out.size, Buffer.byteLength(text));
  assert.deepEqual(fromHpw(text).panel.widgets, p.widgets);

  const imported = await call<{ id: string; name: string; warnings: string[] }>({ op: 'import', text });
  assert.notEqual(imported.id, p.id);
  assert.equal(imported.name, 'Shipping 2');
  assert.deepEqual(imported.warnings, []);
  assert.deepEqual((await call<Panel>({ op: 'load', id: imported.id })).widgets, p.widgets);

  // Strict: what it can't take is said, and a file that isn't one refused.
  const odd = toHpw({ ...p, widgets: [...p.widgets, { ...newWidget('text', 't', { x: 0, y: 0 }), type: 'laser' as never }] });
  assert.deepEqual((await call<{ warnings: string[] }>({ op: 'import', text: odd })).warnings, ['Left out widget “t”: there’s no widget type “laser”.']);
  await assert.rejects(call({ op: 'import', text: '{"format":"zip"}' }), /isn’t a \.hpw file/);
});
