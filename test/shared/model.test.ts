// A panel from anywhere made sound (src/shared/model): types kept or left
// out, ids made unique identifiers, sizes within the canvas, props by type,
// values of their kind.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { coerce, idProblem, initialValues, newWidget, normalizePanel, type Panel, TYPES, uniqueId, uniqueName, WIDGET_TYPES } from '../../src/shared/index.ts';

describe('normalizePanel', () => {
  test('a sound panel stays as it is', () => {
    const panel: Panel = {
      id: 'p1',
      name: 'Deploy',
      width: 640,
      height: 480,
      widgets: [newWidget('button', 'deploy', { x: 16, y: 16 }), newWidget('select', 'env', { x: 16, y: 64 })],
    };
    panel.widgets[0].script = "await run('echo hi')";
    const { panel: out, warnings } = normalizePanel(structuredClone(panel), { id: 'p1' });
    assert.deepEqual(out, panel);
    assert.deepEqual(warnings, []);
  });

  test('every type has defaults that normalize to themselves', () => {
    for (const type of WIDGET_TYPES) {
      const w = newWidget(type, `${type}1`, { x: 0, y: 0 });
      const { panel, warnings } = normalizePanel({ name: 'x', widgets: [w] }, { id: 'p' });
      assert.deepEqual(panel.widgets[0], w, type);
      assert.deepEqual(warnings, [], type);
    }
  });

  test('unknown types are left out, with a warning', () => {
    const { panel, warnings } = normalizePanel({ widgets: [{ id: 'a', type: 'chart' }, { id: 'b', type: 'button' }, 'junk'] });
    assert.deepEqual(
      panel.widgets.map((w) => w.id),
      ['b'],
    );
    assert.deepEqual(warnings, ['Left out widget “a”: there’s no widget type “chart”.', 'Left out widget 3: it isn’t an object.']);
  });

  test('ids: bad and repeated ones are renamed, missing ones made', () => {
    const { panel, warnings } = normalizePanel({
      widgets: [
        { id: 'go', type: 'button' },
        { id: 'go', type: 'button' },
        { id: '1st place', type: 'text' },
        { type: 'input' },
        { id: 'true', type: 'checkbox' },
      ],
    });
    assert.deepEqual(
      panel.widgets.map((w) => w.id),
      ['go', 'go2', '_1st_place', 'input1', 'true_'],
    );
    assert.equal(warnings.length, 3);
    assert.match(warnings[0], /Widget “go” is “go2” now: Another widget is “go” already\./);
  });

  test('sizes are clamped to the canvas, and the canvas to its limits', () => {
    const { panel, warnings } = normalizePanel({
      width: 99999,
      height: 10,
      widgets: [{ id: 'big', type: 'group', x: -50, y: 3000, w: 99999, h: 2 }],
    });
    assert.equal(panel.width, 4000);
    assert.equal(panel.height, 120);
    assert.deepEqual((({ x, y, w, h }) => ({ x, y, w, h }))(panel.widgets[0]), { x: 0, y: 112, w: 4000, h: 8 });
    assert.ok(warnings.includes('The canvas’s width is 4000 now.'));
    assert.ok(warnings.includes('Widget “big” was moved or resized to fit the canvas.'));
  });

  test('props: only the type’s, each of its kind; a choice starts on one of its options', () => {
    const { panel } = normalizePanel({
      widgets: [
        { id: 'b', type: 'button', props: { label: 7, variant: 'neon', options: ['x'], evil: '<script>' } },
        { id: 's', type: 'select', props: { options: ['a', 2, { x: 1 }, null], value: 'zzz' } },
        { id: 'n', type: 'number', props: { min: 10, max: 1, step: -2, value: 500 } },
        { id: 'c', type: 'checkbox', props: { value: 'yes' } },
      ],
    });
    const [b, s, n, c] = panel.widgets;
    assert.deepEqual(b.props, { label: '7', variant: 'primary' });
    assert.deepEqual(s.props, { label: 'Select', options: ['a', '2'], value: 'a' });
    assert.deepEqual(n.props, { label: 'Number', min: 1, max: 10, step: 1, value: 10 });
    assert.deepEqual(c.props, { label: 'Checkbox', value: false });
  });

  test('a script only on widgets that run one', () => {
    const { panel } = normalizePanel({
      widgets: [
        { id: 't', type: 'text', script: 'x()' },
        { id: 'i', type: 'input', script: 'x()' },
      ],
    });
    assert.equal(panel.widgets[0].script, '');
    assert.equal(panel.widgets[1].script, 'x()');
  });

  test('anything else is an empty panel', () => {
    for (const junk of [null, 5, 'x', []]) {
      const { panel, warnings } = normalizePanel(junk, { id: 'p' });
      assert.deepEqual(panel, { id: 'p', name: 'Panel', width: 864, height: 528, widgets: [] });
      assert.equal(warnings.length, 1);
    }
  });
});

describe('values', () => {
  test('coerce: a value as its widget holds it', () => {
    assert.equal(coerce('number', '42'), 42);
    assert.equal(coerce('number', 'abc'), 0);
    assert.equal(coerce('number', 150, { min: 0, max: 100 }), 100);
    assert.equal(coerce('boolean', 'true'), true);
    assert.equal(coerce('boolean', 'yes'), false);
    assert.equal(coerce('string', 12), '12');
    assert.equal(coerce('string', null), '');
    assert.equal(coerce('string', { a: 1 }), '{"a":1}');
    assert.equal(coerce('none', 1), null);
  });

  test('initialValues: each widget’s default; a Text’s is its text; none for buttons', () => {
    const widgets = WIDGET_TYPES.map((t) => newWidget(t, t, { x: 0, y: 0 }));
    const values = initialValues(widgets);
    assert.equal(values.text, 'Text');
    assert.equal(values.badge, 'Ready');
    assert.equal(values.number, 0);
    assert.equal(values.slider, 50);
    assert.equal(values.switch, false);
    assert.equal(values.select, 'One');
    assert.equal(values.log, '');
    assert.equal(values.progress, 0);
    for (const none of ['button', 'divider', 'group']) assert.ok(!(none in values), none);
    assert.equal(Object.keys(values).length, WIDGET_TYPES.filter((t) => TYPES[t].value !== 'none').length);
  });
});

describe('names', () => {
  test('idProblem says why', () => {
    assert.equal(idProblem('deploy', []), null);
    assert.equal(idProblem('$x_1', []), null);
    assert.match(idProblem('', [])!, /empty/);
    assert.match(idProblem('2fast', [])!, /doesn’t start with a digit/);
    assert.match(idProblem('a-b', [])!, /letters, digits/);
    assert.match(idProblem('null', [])!, /means something else/);
    assert.match(idProblem('a', ['a'])!, /already/);
  });

  test('uniqueId counts on', () => {
    assert.equal(uniqueId('button1', []), 'button1');
    assert.equal(uniqueId('button1', ['button1']), 'button2');
    assert.equal(uniqueId('button2', ['button1', 'button2', 'button3']), 'button4');
    assert.equal(uniqueId('deploy', ['deploy']), 'deploy2');
    assert.equal(uniqueId('Deploy now!', []), 'Deploy_now_');
  });

  test('uniqueName counts on, whatever the case', () => {
    assert.equal(uniqueName('Deploy', []), 'Deploy');
    assert.equal(uniqueName('Deploy', ['deploy']), 'Deploy 2');
    assert.equal(uniqueName('Deploy 2', ['Deploy 2', 'Deploy 3']), 'Deploy 4');
    assert.equal(uniqueName('  ', []), 'Panel');
  });
});
