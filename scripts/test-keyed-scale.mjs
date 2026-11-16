import assert from 'node:assert/strict';
import { scoreKeyedScales } from '../src/core/keyedScale.ts';
import { calculateFourAxisResult } from '../src/core/fourAxis.ts';
import { legacyTest as test } from './fixtures/legacy-test.mjs';
import bank from '../src/instance/naifrog-bank.json' with { type: 'json' };
import scenes from './fixtures/naifrog-scenes-v8.json' with { type: 'json' };

const key = [{ id: 'positive', scale: 's', direction: 1 }, { id: 'negative', scale: 's', direction: -1 }];
// 独立的完整真值表：正反向 25 种响应，最小2、最大10；不是用被测函数生成预期值。
for (let positive = 1; positive <= 5; positive++) {
  for (let negative = 1; negative <= 5; negative++) {
    const [result] = scoreKeyedScales(key, { positive, negative });
    assert.equal(result.rawTotal, positive + 6 - negative);
    assert.equal(result.minimum, 2);
    assert.equal(result.maximum, 10);
    assert.equal(result.normalized, (positive + 6 - negative - 2) / 8);
  }
}
// 三档独立真值表，防止只删掉两个按钮却仍按五档原始分计算。
for (let positive = 1; positive <= 3; positive++) {
  for (let negative = 1; negative <= 3; negative++) {
    const [result] = scoreKeyedScales(key, { positive, negative }, 3);
    assert.equal(result.rawTotal, positive + 4 - negative);
    assert.equal(result.minimum, 2);
    assert.equal(result.maximum, 6);
    assert.equal(result.normalized, (positive + 4 - negative - 2) / 4);
  }
}
assert.throws(() => scoreKeyedScales(key, { positive: 4, negative: 2 }, 3), /整数/);
assert.throws(() => scoreKeyedScales(key, { positive: 1, negative: 1 }, 4), /档数/);
for (const response of [0, 6, 2.5, NaN, Infinity, '3', null]) {
  assert.throws(() => scoreKeyedScales(key, { positive: response, negative: 3 }), /整数/);
}
assert.throws(() => scoreKeyedScales(key, { positive: 3 }), /完成所有题目/);
assert.throws(() => scoreKeyedScales(key, { positive: 3, negative: 3, unknown: 3 }), /未知题目/);
assert.throws(() => scoreKeyedScales([], {}), /必须配置/);
assert.throws(() => scoreKeyedScales([key[0], key[0]], { positive: 3 }), /重复题目/);
assert.throws(() => scoreKeyedScales([{ ...key[0], direction: 0 }], { positive: 3 }), /计分方向/);
const multiple = scoreKeyedScales([...key, { id: 'other', scale: 't', direction: 1 }], { positive: 5, negative: 1, other: 1 });
assert.equal(multiple[0].normalized, 1);
assert.equal(multiple[1].normalized, 0);

// 固定种子的混合作答；从原题计分方向独立计算原始分，再对照兼容路径，保证切换不人为改变人格。
let seed = 20261110;
for (let trial = 0; trial < 1000; trial++) {
  const answers = {};
  const totals = Object.fromEntries(bank.axes.map(axis => [axis.id, 0]));
  for (const question of test.questions) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const selected = seed % 3;
    answers[question.id] = question.options[selected].id;
    const row = scenes.questions.find(row => row.id === question.id);
    totals[row.axis] += row.positive === 'b' ? selected + 1 : 3 - selected;
  }
  const result = calculateFourAxisResult(test, answers);
  const legacy = calculateFourAxisResult({ ...test, scaleScoring: undefined }, answers);
  assert.equal(result.type_code, legacy.type_code);
  assert.equal(result.display_code, legacy.display_code);
  for (const axis of result.preferences) {
    assert.equal(axis.raw_total, totals[axis.dimension]);
    assert.equal(axis.right_percent, Math.round((totals[axis.dimension] - 3) / 6 * 100));
    assert.equal(axis.right_percent, legacy.preferences.find(item => item.dimension === axis.dimension).right_percent);
  }
}
// 旧五档配置不指定 responseLevels 时仍默认五档，不能被本轮三选项改造破坏。
const fiveLevel = structuredClone(test);
delete fiveLevel.responseLevels;
delete fiveLevel.typeResolution;
fiveLevel.questions.forEach(question => {
  const { scale, direction } = question.scoringKey;
  question.options = [1, 2, 3, 4, 5].map(value => ({ id: String(value), responseValue: value,
    text: String(value), scores: { [scale]: ((direction === 1 ? value : 6 - value) - 1) / 4 } }));
});
const fiveNeutral = calculateFourAxisResult(fiveLevel, Object.fromEntries(fiveLevel.questions.map(q => [q.id, '3'])));
assert.equal(fiveNeutral.display_code, 'XXXX');
assert.ok(fiveNeutral.preferences.every(axis => axis.raw_total === 9 && axis.raw_maximum === 15));
for (const mutate of [
  config => { config.questions[0].scoringKey.direction = 0; },
  config => { config.questions[0].scoringKey.scale = 'bad'; },
  config => { config.questions[0].options[0].responseValue = 2; },
  config => { config.questions[0].options[0].responseValue = '1'; },
  config => { config.questions[0].options[0].id = config.questions[0].options[1].id; },
  config => { config.questions[0].scoringKey = undefined; },
  config => { config.responseLevels = 4; },
  config => { config.questions[0].options.pop(); },
  config => { config.questions[0].options[0].responseValue = 4; }
]) {
  const invalid = structuredClone(test);
  mutate(invalid);
  assert.throws(() => calculateFourAxisResult(invalid, {}));
}
console.log('PASS: 三档9种及五档25种正反向真值、旧五档默认兼容、非法响应/缺答/重复键/未知题、1000条三档独立对照、损坏配置拒绝');
