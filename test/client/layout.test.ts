// The editor's geometry and edits (src/client/lib): snapping to the grid,
// resizing by each handle, nudging, finding room, groups taking what's in
// them along, copies, ids typed in, and undo's steps. No DOM.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { addWidget, canvasFits, dragged, duplicated, insideOf, nudged, placed, restacked } from '../../src/client/lib/layout.ts';
import { emptyHistory, MERGE_MS, record, redo, undo } from '../../src/client/lib/history.ts';
import { renameIn, renameProblem } from '../../src/client/lib/ids.ts';
import { readPicked } from '../../src/client/lib/files.ts';
import { freeSpot, moveRect, nudgeRect, resizeRect, snap } from '../../src/client/lib/snap.ts';
import { newWidget, type Panel } from '../../src/shared/index.ts';

const canvas = { width: 400, height: 300 };
const box = { x: 40, y: 40, w: 80, h: 32 };

function panelOf(...widgets: ReturnType<typeof newWidget>[]): Panel {
  return { id: 'p', name: 'P', width: canvas.width, height: canvas.height, widgets };
}

describe('snap', () => {
  test('to the 8px grid', () => {
    assert.equal(snap(0), 0);
    assert.equal(snap(3), 0);
    assert.equal(snap(4), 8);
    assert.equal(snap(13), 16);
    assert.equal(snap(-5), -8);
  });

  test('moving snaps and stays on the canvas', () => {
    assert.deepEqual(moveRect(box, 5, 3, canvas), { ...box, x: 48, y: 40 });
    assert.deepEqual(moveRect(box, -100, -100, canvas), { ...box, x: 0, y: 0 });
    assert.deepEqual(moveRect(box, 1000, 1000, canvas), { ...box, x: 320, y: 268 });
  });

  test('resizing moves the handle’s edges only, to the grid, never below the least size', () => {
    assert.deepEqual(resizeRect(box, 'se', 21, 9, canvas), { x: 40, y: 40, w: 104, h: 40 });
    assert.deepEqual(resizeRect(box, 'nw', -13, 6, canvas), { x: 24, y: 48, w: 96, h: 24 });
    assert.deepEqual(resizeRect(box, 'e', -500, 0, canvas), { x: 40, y: 40, w: 8, h: 32 }, 'never narrower than a grid step');
    assert.deepEqual(resizeRect(box, 'w', -500, 0, canvas), { x: 0, y: 40, w: 120, h: 32 }, 'never past the canvas');
    assert.deepEqual(resizeRect(box, 's', 0, 1000, canvas), { x: 40, y: 40, w: 80, h: 260 });
    assert.deepEqual(resizeRect(box, 'n', 0, 1000, canvas), { x: 40, y: 64, w: 80, h: 8 });
  });

  test('nudging: a pixel, or a grid step with Shift', () => {
    assert.deepEqual(nudgeRect(box, 'ArrowRight', false, canvas), { ...box, x: 41 });
    assert.deepEqual(nudgeRect(box, 'ArrowUp', true, canvas), { ...box, y: 32 });
    assert.deepEqual(nudgeRect({ ...box, x: 0 }, 'ArrowLeft', true, canvas), { ...box, x: 0 });
  });

  test('freeSpot: the first place with room, groups not in the way', () => {
    assert.deepEqual(freeSpot([], 80, 32, canvas), { x: 8, y: 8 });
    const taken = [{ x: 8, y: 8, w: 200, h: 32 }];
    const spot = freeSpot(taken, 80, 32, canvas);
    assert.deepEqual(spot, { x: 216, y: 8 }, 'beside it, a grid step apart');
    assert.deepEqual(freeSpot([{ x: 0, y: 0, w: 400, h: 300, type: 'group' }], 80, 32, canvas), { x: 8, y: 8 });
    const full = [{ x: 0, y: 0, w: 400, h: 300 }];
    assert.deepEqual(freeSpot(full, 80, 32, canvas), { x: 16, y: 16 }, 'no room: a step in, by how many there are');
  });
});

describe('layout', () => {
  test('a new widget where there’s room, or where it was dropped, snapped; groups under the rest', () => {
    const p = panelOf(newWidget('button', 'go', { x: 8, y: 8 }));
    const added = addWidget(p, 'input');
    assert.equal(added.id, 'input1');
    assert.deepEqual(
      added.widgets.map((w) => w.id),
      ['go', 'input1'],
    );
    const dropped = addWidget(p, 'text', { x: 101, y: 59 });
    assert.deepEqual((({ x, y }) => ({ x, y }))(dropped.widgets.at(-1)!), { x: 104, y: 56 });
    const group = addWidget(p, 'group', { x: 0, y: 0 });
    assert.equal(group.widgets[0].type, 'group');
  });

  test('a group takes what’s inside it along; others stay', () => {
    const g = { ...newWidget('group', 'g', { x: 0, y: 0 }), w: 200, h: 100 };
    const inside = newWidget('button', 'in', { x: 16, y: 16 });
    const outside = newWidget('button', 'out', { x: 240, y: 16 });
    const p = panelOf(g, inside, outside);
    assert.deepEqual(insideOf(g, p.widgets), ['in']);
    const moved = dragged(p, { id: 'g', handle: 'move', start: p.widgets }, 40, 16);
    assert.deepEqual(
      moved.map((w) => [w.id, w.x, w.y]),
      [
        ['g', 40, 16],
        ['in', 56, 32],
        ['out', 240, 16],
      ],
    );
    const resized = dragged(p, { id: 'g', handle: 'se', start: p.widgets }, 30, 0);
    assert.equal(resized[0].w, 232);
    assert.equal(resized[1].x, 16, 'resizing a group moves nothing in it');
  });

  test('nudge by a pixel (no snapping), copy beside, restack, place by hand', () => {
    const p = panelOf(newWidget('button', 'go', { x: 16, y: 16 }), newWidget('text', 't', { x: 100, y: 100 }));
    assert.equal(nudged(p, 'go', 'ArrowRight', false)[0].x, 17);
    const copy = duplicated(p, 'go')!;
    assert.equal(copy.id, 'go2');
    assert.deepEqual((({ x, y }) => ({ x, y }))(copy.widgets.at(-1)!), { x: 32, y: 32 });
    assert.deepEqual(copy.widgets.at(-1)!.props, p.widgets[0].props);
    assert.notEqual(copy.widgets.at(-1)!.props, p.widgets[0].props, 'a copy, not the same props');
    assert.deepEqual(
      restacked(p.widgets, 't', 'back').map((w) => w.id),
      ['t', 'go'],
    );
    const hand = placed(p, 'go', { x: 390, w: 50 })[0];
    assert.deepEqual((({ x, w }) => ({ x, w }))(hand), { x: 350, w: 50 });
    assert.deepEqual(canvasFits(p), { width: 264, height: 128 }, 'the text at (104, 104), snapped, 160 × 24');
  });
});

describe('ids', () => {
  test('a rename is checked against the others, and conditions follow it', () => {
    const a = { ...newWidget('input', 'env', { x: 0, y: 0 }) };
    const b = { ...newWidget('button', 'go', { x: 0, y: 0 }), enabledWhen: 'env == "prod" && envs != env' };
    assert.equal(renameProblem(a, 'target', [a, b]), null);
    assert.match(renameProblem(a, 'go', [a, b])!, /already/);
    assert.equal(renameProblem(a, 'env', [a, b]), null, 'its own id is fine');
    const out = renameIn([a, b], 'env', 'target');
    assert.equal(out[0].id, 'target');
    assert.equal(out[1].enabledWhen, 'target == "prod" && envs != target');
  });
});

describe('history', () => {
  test('a change a step; a run of one key a single step; undo and redo', () => {
    let h = emptyHistory<string>();
    h = record(h, 'a', null, 0);
    h = record(h, 'b', 'name', 10);
    h = record(h, 'bc', 'name', 20);
    assert.deepEqual(h.past, ['a', 'b'], 'typing is one step');
    h = record(h, 'bcd', 'name', 20 + MERGE_MS + 1);
    assert.deepEqual(h.past, ['a', 'b', 'bcd']);
    const [u, back] = undo(h, 'bcde');
    assert.equal(back, 'bcd');
    const [r, forth] = redo(u, 'bcd');
    assert.equal(forth, 'bcde');
    assert.deepEqual(r.past, ['a', 'b', 'bcd']);
    assert.deepEqual(undo(emptyHistory<string>(), 'x'), [emptyHistory<string>(), null]);
  });
});

describe('files', () => {
  test('an .hpw picked is read; anything else refused', async () => {
    assert.equal(await readPicked({ name: 'a.hpw', size: 2, text: async () => '{}' }), '{}');
    await assert.rejects(readPicked({ name: 'a.png', size: 2, text: async () => '' }), /isn’t a \.hpw file/);
    await assert.rejects(readPicked({ name: 'a.hpw', size: 6 * 1024 * 1024, text: async () => '' }), /too big/);
  });
});
