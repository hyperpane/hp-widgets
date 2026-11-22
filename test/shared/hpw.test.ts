// The .hpw file (src/shared/hpw.ts): written and read back the same, and
// read strictly.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fromHpw, HPW_FORMAT, hpwFileName, newWidget, type Panel, toHpw } from '../../src/shared/index.ts';

const panel: Panel = {
  id: 'kept-out',
  name: 'Release',
  width: 720,
  height: 400,
  widgets: [newWidget('group', 'box', { x: 8, y: 8 }), newWidget('button', 'ship', { x: 24, y: 40 }), newWidget('log', 'out', { x: 24, y: 88 })],
  inputs: ['file'],
  outputs: ['answer'],
  onRun: "output('answer', inputs.file);",
  runOnInput: true,
};
panel.widgets[1].script = "await run('npm publish', { log: 'out' });";
panel.widgets[1].enabledWhen = 'out.length == 0';

test('round trip: the panel comes back as it went, but for its id', () => {
  const text = toHpw(panel);
  const file = JSON.parse(text);
  assert.equal(file.format, HPW_FORMAT);
  assert.equal(file.version, 1);
  assert.ok(!('id' in file.panel), 'no id in the file');
  const { panel: back, warnings } = fromHpw(text);
  assert.deepEqual(warnings, []);
  assert.deepEqual(back, { ...panel, id: '' });
});

test('strict: not JSON, another format or version, no panel', () => {
  assert.throws(() => fromHpw('nope'), /isn’t JSON/);
  assert.throws(() => fromHpw('{"format":"other","version":1,"panel":{}}'), /format isn’t “hyperpane-widget”/);
  assert.throws(() => fromHpw('{"format":"hyperpane-widget","version":2,"panel":{}}'), /version 2/);
  assert.throws(() => fromHpw('{"format":"hyperpane-widget","version":1,"panel":[]}'), /no panel/);
  assert.throws(() => fromHpw(' '.repeat(6 * 1024 * 1024)), /too big/);
});

test('what it can’t take is dropped with a warning; a BOM is fine', () => {
  const text = `${String.fromCharCode(0xfeff)}${JSON.stringify({
    format: HPW_FORMAT,
    version: 1,
    panel: {
      name: 'X',
      widgets: [
        { id: 'a', type: 'hologram' },
        { id: 'b', type: 'text', w: 1e9 },
      ],
    },
  })}`;
  const { panel: back, warnings } = fromHpw(text);
  assert.deepEqual(
    back.widgets.map((w) => w.id),
    ['b'],
  );
  assert.equal(back.widgets[0].w, back.width);
  assert.equal(warnings.length, 2);
});

test('file names: the panel’s, safe on every system', () => {
  assert.equal(hpwFileName('Deploy'), 'Deploy.hpw');
  assert.equal(hpwFileName('a/b:c*?'), 'a b c.hpw');
  assert.equal(hpwFileName('..hidden'), 'hidden.hpw');
  assert.equal(hpwFileName('   '), 'Panel.hpw');
});
