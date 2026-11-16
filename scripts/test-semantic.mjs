import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { naifrogTest as test } from '../src/instance/naifrogTest.ts';
import { calculateFourAxisResult, rankFourAxisTypes } from '../src/core/fourAxis.ts';
import { presentInterpretation, presentShareText } from '../src/core/resultPresentation.ts';
import { TestProtocol } from '../src/protocol/interface.ts';
import scenes from '../src/instance/naifrog-scenes.json' with { type: 'json' };
import approved from './fixtures/naifrog-scenes-v10-approved.json' with { type: 'json' };

const axes = ['ei', 'sn', 'tf', 'jp'];
const letters = [['I', 'E'], ['S', 'N'], ['T', 'F'], ['J', 'P']];
const defaults = ['I', 'N', 'F', 'P'];
assert.equal(test.version, 'naifrog-scenes-12-v10-abstract-20261116');
assert.equal(test.scaleScoring, 'semantic_weighted');
assert.equal(test.questions.length, 12);
assert.deepEqual(axes.map(axis => test.questions.filter(q => axis in q.options[0].scores).length), [6, 2, 3, 1]);
// 成员编辑文档会被改写为其他素材，不能作为自动化测试的长期基准；冻结已审核上线的v10配置。
assert.deepEqual(scenes, approved, '正式题库必须与已审核v10基准一致');
const table = approved.questions.map((q, index) => [String(index + 1), `${q.scene}：${q.title}`, q.text, q.a, q.neutral, q.b]);
assert.equal(table.length, 12);
test.questions.forEach((question, index) => {
  const row = table[index];
  assert.equal(Number(row[0]), index + 1);
  assert.equal(question.text, row[2]);
  assert.deepEqual(question.options.map(option => option.text), row.slice(3));
  assert.deepEqual(question.options.map(option => option.id), ['a', 'neutral', 'b']);
  assert.equal(question.scene, row[1].split('：')[0] === '日常' ? '日常生活' : row[1].split('：')[0]);
  assert.ok(question.options.every(option => option.text.length > 0 && option.text.length <= 80));
  assert.ok(question.scoringWeight > 0 && question.scoringWeight <= 4);
});
assert.equal(test.questions[0].title, '在朋友群里发了消息');
assert.equal(test.questions[1].title, '和朋友在路上看到建模怪');
assert.equal(test.questions[4].options[2].text, '哦哦哦');
assert.equal(test.questions[6].options[1].scores.ei, 0.75);
assert.equal(test.questions[6].options[0].scores.ei, 0.5);
assert.equal(test.questions[7].options[2].scores.ei, 0.5);
assert.equal(test.questions[2].scoringWeight, 0.25);
for (const index of [1, 2, 4]) assert.ok(test.questions[index].options.every(o => Object.values(o.scores)[0] === 0.5), '纯梗不得强行推断人格');

const neutral = Object.fromEntries(test.questions.map(question => [question.id,
  question.options.find(option => Object.values(option.scores).every(score => score === 0.5)).id]));
const neutralResult = calculateFourAxisResult(test, neutral);
assert.equal(neutralResult.type_code, 'INFP');
assert.ok(neutralResult.preferences.every(axis => axis.resolution === 'fallback' && axis.right_percent === 50));
assert.match(neutralResult.interpretation, /本组回答未提供明确方向/);
assert.doesNotMatch(neutralResult.interpretation, /全部选中间/);
// 第二个按钮在新版第7题明确是互动线索，不得被旧ID“neutral”强行清零。
const allSecond = calculateFourAxisResult(test, Object.fromEntries(test.questions.map(q => [q.id, 'neutral'])));
assert.equal(allSecond.type_code, 'ENFP');
assert.equal(allSecond.preferences[0].right_percent, 55);
assert.equal(allSecond.preferences[0].resolution, 'majority');
const protocol = new TestProtocol();
protocol.registerTest(test);
protocol.startTest(test.id);
test.questions.forEach(q => protocol.submitAnswer(q.id, 'neutral'));
assert.deepEqual(protocol.getResult(), allSecond);
// 真实提交入口改答覆盖而非累计；第7题选第一项后回到完全无方向的默认角色。
protocol.submitAnswer('q07', 'a');
assert.deepEqual(protocol.getResult(), neutralResult);

// 小数权重的机器尾差不能把数学上的平分误判为左侧多数。
const decimals = structuredClone(test);
const decimalAnswers = { ...neutral };
for (const [id, weight, selected] of [['q01', 0.3, 'b'], ['q07', 0.1, 'a'], ['q08', 0.2, 'a']]) {
  const q = decimals.questions.find(q => q.id === id);
  q.scoringWeight = weight;
  q.options.forEach((option, i) => { option.scores = { ei: [0, 0.5, 1][i] }; });
  decimalAnswers[id] = selected;
}
// 第1题偏右，其余两题偏左：右侧权重0.3与左侧0.1+0.2数学上相等。
const decimalAxis = calculateFourAxisResult(decimals, decimalAnswers).preferences[0];
assert.equal(decimalAxis.right_percent, 50);
assert.equal(decimalAxis.resolution, 'tie_break');
assert.equal(decimalAxis.letter, 'E');

// 穷举每轴独立选项路径：4题81条、2题9条、3题各27条；按JSON配置独立计算预期。
let patterns = 0;
for (const [index, axis] of axes.entries()) {
  const questions = scenes.questions.filter(q => q.axis === axis);
  for (let pattern = 0; pattern < 3 ** questions.length; pattern++) {
    let digits = pattern, total = 0;
    const values = [], answers = { ...neutral };
    questions.forEach(q => {
      const selected = digits % 3; digits = Math.floor(digits / 3);
      answers[q.id] = ['a', 'neutral', 'b'][selected];
      values.push(q.scores[selected]); total += q.scores[selected] * q.weight;
    });
    const weight = questions.reduce((sum, q) => sum + q.weight, 0);
    const ratio = total / weight;
    const first = values.find(value => value !== 0.5);
    const expected = ratio > 0.5 ? letters[index][1] : ratio < 0.5 ? letters[index][0]
      : first === undefined ? defaults[index] : first > 0.5 ? letters[index][1] : letters[index][0];
    const result = calculateFourAxisResult(test, answers);
    const preference = result.preferences[index];
    assert.equal(preference.letter, expected);
    assert.equal(preference.right_percent, Math.round(ratio * 100));
    assert.equal(preference.left_percent + preference.right_percent, 100);
    assert.equal(preference.raw_total, total);
    assert.equal(preference.weight_total, weight);
    assert.equal(preference.item_count, questions.length);
    assert.equal(preference.resolution, ratio !== 0.5 ? 'majority' : first === undefined ? 'fallback' : 'tie_break');
    assert.match(result.interpretation, /未提供方向/);
    assert.doesNotMatch(presentInterpretation(result.interpretation, result.preferences), /[A-Z]/);
    assert.deepEqual(calculateFourAxisResult({ ...test, questions: [...test.questions].reverse() }, answers), result);
    patterns++;
  }
}
const reached = new Set();
for (const persona of test.personalityTypes) {
  const answers = Object.fromEntries(test.questions.map(question => {
    const axis = Object.keys(question.options[0].scores)[0];
    const index = axes.indexOf(axis);
    const wantRight = persona.id[index] === letters[index][1];
    const selected = [...question.options].sort((a, b) => (wantRight ? -1 : 1) * (a.scores[axis] - b.scores[axis]))[0];
    return [question.id, selected.id];
  }));
  const result = calculateFourAxisResult(test, answers);
  assert.equal(result.type_code, persona.id);
  assert.equal(rankFourAxisTypes(test, result)[0].personalityType.id, persona.id);
  assert.ok(existsSync(new URL(`../src/assets/optimized/personas/${persona.id.toLowerCase()}.webp`, import.meta.url)));
  assert.ok(presentShareText(persona.name, false, false).includes(persona.name));
  assert.doesNotMatch(presentShareText(persona.name, false, false), /\b[IE][NS][TF][JP]\b/);
  const reordered = { ...test, questions: test.questions.map(q => ({ ...q, options: [...q.options].reverse() })) };
  assert.deepEqual(calculateFourAxisResult(reordered, answers), result);
  reached.add(result.type_code);
}
assert.equal(reached.size, 16);
for (const mutate of [
  t => { t.questions[0].scoringWeight = 0; }, t => { t.questions[0].scoringWeight = -1; },
  t => { t.questions[0].scoringWeight = NaN; }, t => { t.questions[0].scoringWeight = Infinity; },
  t => { t.questions[0].scoringWeight = 4.1; }, t => { t.questions[0].options[0].scores.ei = NaN; },
  t => { t.questions[0].options[0].scores.ei = 1.1; }, t => { t.questions[0].options[0].scores.ei = -0.1; },
  t => { t.questions[0].options[0].scores = { unknown: 1 }; }, t => { t.questions[0].options[0].scores = {}; },
  t => { t.questions[0].options[1].scores = { sn: 0.5 }; }, t => { t.questions[1].id = t.questions[0].id; },
  t => { t.questions[0].options[0].id = ''; }, t => { t.questions[0].options[0].id = 'neutral'; },
  t => { t.questions[0].options.pop(); }, t => { t.responseLevels = 5; }
]) {
  const invalid = structuredClone(test); mutate(invalid);
  assert.throws(() => calculateFourAxisResult(invalid, neutral));
}
assert.throws(() => calculateFourAxisResult(test, {}), /完成所有题目/);
assert.throws(() => calculateFourAxisResult(test, { ...neutral, unknown: 'a' }), /未知题目/);
assert.throws(() => calculateFourAxisResult(test, { ...neutral, q01: 'invalid' }), /完成所有题目/);
console.log(`PASS: 当前原文/顺序逐项一致；${patterns}条语义路径、16型可达、权重归一化、第二项非默认中立、位置无关、非法配置拒绝。`);
