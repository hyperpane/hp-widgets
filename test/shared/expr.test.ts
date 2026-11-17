// Conditions (src/shared/expr): read without eval, worked out as
// JavaScript would work out the same text, and their mistakes said with
// where they are.

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { conditionProblem, ExprError, evaluate, holds, parse, tokenize } from '../../src/shared/index.ts';

const run = (src: string, scope: Record<string, string | number | boolean | null> = {}) => evaluate(parse(src), scope);

describe('reading', () => {
  test('tokens: numbers, text with escapes, names, operators longest first', () => {
    assert.deepEqual(
      tokenize(`a === 'x\\'y' !== 1.5`).map((t) => (t.type === 'end' ? 'end' : t.value)),
      ['a', '===', "x'y", '!==', 1.5, 'end'],
    );
    assert.deepEqual(
      tokenize('"a\\nb"').map((t) => (t.type === 'string' ? t.value : t.type)),
      ['a\nb', 'end'],
    );
  });

  test('precedence: && over ||, comparison over &&, + over comparison', () => {
    assert.equal(run('true || false && false'), true);
    assert.equal(run('(true || false) && false'), false);
    assert.equal(run('1 + 2 == 3 && 2 < 3'), true);
    assert.equal(run('1 + 2 * 3'.replace(' * 3', '')), 3);
    assert.equal(run('10 - 2 - 3'), 5, 'left to right');
    assert.equal(run('!false == true'), true, '! binds tighter than ==');
    assert.equal(run('-1 + 3'), 2);
    assert.equal(run('a - -b', { a: 1, b: 2 }), 3);
  });

  test('a tree of names, literals and .length', () => {
    assert.deepEqual(parse('name.length > 0'), {
      kind: 'binary',
      op: '>',
      left: { kind: 'length', of: { kind: 'name', name: 'name', at: 0 }, at: 4 },
      right: { kind: 'literal', value: 0 },
    });
  });
});

describe('working out', () => {
  test('names are widgets’ values', () => {
    assert.equal(run('env == "prod" && confirm', { env: 'prod', confirm: true }), true);
    assert.equal(run('env == "prod" && confirm', { env: 'prod', confirm: false }), false);
    assert.equal(run('branch.length', { branch: 'main' }), 4);
    assert.equal(run('count >= 3', { count: 3 }), true);
  });

  test('as JavaScript: loose and strict equality, + joining text, && and || giving a side', () => {
    assert.equal(run('n == "5"', { n: 5 }), true);
    assert.equal(run('n === "5"', { n: 5 }), false);
    assert.equal(run('n != "5"', { n: 5 }), false);
    assert.equal(run('x == null', { x: null }), true);
    assert.equal(run('0 == null'), false);
    assert.equal(run('true == 1'), true);
    assert.equal(run('"a" + 1'), 'a1');
    assert.equal(run('1 + true'), 2);
    assert.equal(run('"" || "fallback"'), 'fallback');
    assert.equal(run('"x" && 0'), 0);
    assert.equal(run('"b" > "a"'), true);
    assert.equal(run('"10" < 9'), false);
  });

  test('holds: empty and wrong conditions hold, so nothing is hidden by a mistake', () => {
    assert.equal(holds('', {}), true);
    assert.equal(holds('   ', {}), true);
    assert.equal(holds('a &&', { a: false }), true);
    assert.equal(holds('missing', {}), true);
    assert.equal(holds('a', { a: '' }), false);
    assert.equal(holds('!a', { a: '' }), true);
  });
});

describe('mistakes', () => {
  const error = (src: string) => {
    try {
      parse(src);
    } catch (e) {
      assert.ok(e instanceof ExprError);
      return { message: e.message, at: e.at };
    }
    assert.fail(`“${src}” parsed`);
  };

  test('say what and where', () => {
    assert.deepEqual(error('a ='), { message: 'Compare with == (a single = would set a value).', at: 2 });
    assert.deepEqual(error('a & b'), { message: 'Use && for “and”.', at: 2 });
    assert.deepEqual(error('(a || b'), { message: 'Expected “)” but found the end.', at: 7 });
    assert.deepEqual(error('a b'), { message: 'Unexpected “b”.', at: 2 });
    assert.deepEqual(error("'open"), { message: 'This text has no closing quote.', at: 0 });
    assert.deepEqual(error('a.size'), { message: 'Only .length can follow a value.', at: 2 });
    assert.deepEqual(error('a + '), { message: 'The condition ends too soon.', at: 4 });
    assert.deepEqual(error('a; b'), { message: 'A condition can’t have “;”.', at: 1 });
    assert.equal(error('').message, 'The condition is empty.');
    assert.equal(error('1abc').message, '“1a” isn’t a number or a name.');
  });

  test('no way to reach anything but the values', () => {
    assert.match(error('constructor.constructor("x")').message, /Only \.length/);
    assert.throws(() => run('constructor', {}), /no widget “constructor”/);
    assert.throws(() => run('toString', {}), /no widget “toString”/);
  });

  test('evaluation errors: a widget that isn’t there, .length of a number', () => {
    assert.throws(
      () => run('nope == 1', { a: 1 }),
      (e: ExprError) => e.message === 'There’s no widget “nope” with a value.' && e.at === 0,
    );
    assert.throws(() => run('n.length', { n: 3 }), /\.length is for text, not number/);
  });

  test('conditionProblem: a mistake, or a widget it names that has no value', () => {
    assert.equal(conditionProblem('', []), null);
    assert.equal(conditionProblem('env == "prod"', ['env']), null);
    assert.equal(conditionProblem('env == "prod"', ['other']), 'There’s no widget “env” with a value.');
    assert.equal(conditionProblem('env ==', ['env']), 'The condition ends too soon.');
  });
});
