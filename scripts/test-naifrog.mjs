import assert from 'node:assert/strict';
import { legacyTest as test } from './fixtures/legacy-test.mjs';
import { calculateFourAxisResult, rankFourAxisTypes } from '../src/core/fourAxis.ts';
import { TestProtocol } from '../src/protocol/interface.ts';
import appearances from '../src/instance/naifrog-appearance.json' with { type: 'json' };
import { presentInterpretation, presentAxisNote, presentShareText } from '../src/core/resultPresentation.ts';
import { existsSync, statSync } from 'node:fs';

const axes = ['ei', 'sn', 'tf', 'jp'];
assert.equal(test.questions.length, 12);
assert.equal(new Set(test.questions.map(q => q.id)).size, 12);
assert.deepEqual(test.questions.map(q => q.scene), [...Array(4).fill('与恋人'), ...Array(4).fill('与朋友'), ...Array(4).fill('日常生活')]);
const names = { INTJ: '奶马', INTP: 'Dr.奶', ENTJ: '蛙猛先生', ENTP: '蛙哈哈', INFJ: '奶蛋', INFP: '奶蝶', ENFJ: '奶使', ENFP: '奶狗', ISTJ: '奶sir', ISFJ: '豆奶', ESTJ: '奶坤', ESFJ: '蛙祖', ISTP: '奶工', ISFP: '忧郁蛙', ESTP: '奶豪', ESFP: '魅魔蛙' };
assert.equal(appearances.length, 16);
assert.deepEqual(Object.fromEntries(appearances.map(p => [p.code, p.name])), names);
const cutouts = appearances.filter(persona => persona.cutout);
assert.deepEqual(cutouts.map(persona => persona.code).sort(), ['ENTP', 'ESFJ', 'ESTJ', 'INFJ', 'INFP', 'ISFP']);
for (const cutout of cutouts) {
  assert.ok(existsSync(new URL(`../${cutout.cutout}`, import.meta.url)), `${cutout.name} 缺少抠图源文件`);
}
for (const persona of test.personalityTypes) {
  assert.equal(persona.name, names[persona.id]);
  const asset = new URL(`../src/assets/optimized/personas/${persona.id.toLowerCase()}.webp`, import.meta.url);
  assert.ok(existsSync(asset), `${persona.name} 缺少素材`);
  assert.ok(statSync(asset).size < 100 * 1024);
}
assert.equal(test.personalityTypes.length, 16);
assert.equal(new Set(test.personalityTypes.map(p => p.id)).size, 16);
assert.equal(new Set(test.personalityTypes.map(p => p.name)).size, 16);
assert.equal(new Set(test.personalityTypes.map(p => p.meme)).size, 16);
assert.equal(new Set(test.personalityTypes.map(p => p.description)).size, 16);
for (const persona of test.personalityTypes) {
  const [scene, relationship, skill, pitfall, advice, ...extra] = persona.description.split('\n\n');
  assert.ok(scene?.length >= 35 && persona.meme.length <= 45 && extra.length === 0, `${persona.id} 评语结构或金句长度错误`);
  assert.match(skill, /^你的顺手技能：.+/);
  assert.match(relationship, /^亲近的人面前：.{35,120}$/u);
  assert.match(pitfall, /^偶尔会卡住：.+/);
  assert.match(advice, /^给这只蛙的小建议：.+/);
}
assert.equal(new Set(test.personalityTypes.map(p => p.description.split('\n\n')[1])).size, 16);
for (const axis of axes) {
  assert.equal(test.questions.filter(q => axis in q.options[0].scores).length, 3);
}
for (const question of test.questions) {
  assert.equal(question.options.length, 3);
  assert.deepEqual(question.options.map(o => o.id), ['a', 'neutral', 'b']);
  assert.deepEqual(question.options.map(o => o.responseValue), [1, 2, 3]);
  for (const option of question.options) {
    // 正文字数去除标点和空白；总显示字符也设15上限，避免靠标点挤长按钮。
    const contentLength = Array.from(option.text.replace(/[\p{P}\p{Z}\s]/gu, '')).length;
    assert.ok(contentLength >= 8 && contentLength <= 15, `${question.id}/${option.id} 正文须为8～15字`);
    assert.ok(Array.from(option.text).length <= 15, `${question.id}/${option.id} 显示字符不能超过15`);
  }
  assert.ok(Array.from(question.text).length <= 30);
  const keys = Object.keys(question.options[0].scores);
  assert.equal(keys.length, 1);
  assert.ok(axes.includes(keys[0]));
  assert.deepEqual(Object.keys(question.options[1].scores), keys);
  assert.deepEqual(question.options.map(o => o.scores[keys[0]]).sort(), [0, 0.5, 1]);
}

// 每轴正向票数 0～3 的全部组合，覆盖新版短题库全部 256 种两端票数形态。
const reached = new Set();
const visibleTypes = new Set();
let checked = 0;
for (let combination = 0; combination < 256; combination++) {
  const counts = axes.map((_, i) => (combination >> (i * 2)) & 3);
  const used = [0, 0, 0, 0];
  const answers = Object.fromEntries(test.questions.map(q => {
    const axis = Object.keys(q.options[0].scores)[0];
    const index = axes.indexOf(axis);
    const desired = used[index]++ < counts[index] ? 1 : 0;
    return [q.id, q.options.find(o => o.scores[axis] === desired).id];
  }));
  const expected = [counts[0] >= 2 ? 'E' : 'I', counts[1] >= 2 ? 'N' : 'S', counts[2] >= 2 ? 'F' : 'T', counts[3] >= 2 ? 'P' : 'J'].join('');
  const result = calculateFourAxisResult(test, answers);
  assert.equal(result.type_code, expected);
  assert.equal(result.personality_type, expected);
  assert.match(result.interpretation, /本次回答|本次两侧/);
  assert.equal(rankFourAxisTypes(test, result)[0].personalityType.id, expected);
  assert.notEqual(result.interpretation, test.personalityTypes.find(p => p.id === expected).description);
  assert.doesNotMatch(presentInterpretation(result.interpretation, result.preferences), /\b[IE][NS][TF][JP]\b|[IE]\/|[SN]\/|[TF]\/|[JP]\//);
  assert.doesNotMatch(presentShareText(names[expected], false, false), /\b[IE][NS][TF][JP]\b/);
  result.preferences.forEach((p, i) => {
    assert.equal(p.right_percent, Math.round(counts[i] / 3 * 100));
    assert.equal(p.left_percent + p.right_percent, 100);
    assert.equal(p.close, false);
    assert.ok(result.interpretation.split('\n\n')[i].includes(`左侧 ${3 - counts[i]} 次 · 中间 0 次 · 右侧 ${counts[i]} 次`));
  });
  if (!result.display_code.includes('X')) visibleTypes.add(result.display_code);
  // 改变题目排列不应改变计算结果。
  if (combination % 127 === 0) {
    assert.deepEqual(calculateFourAxisResult({ ...test, questions: [...test.questions].reverse() }, answers), result);
  }
  reached.add(expected);
  checked++;
}
assert.equal(reached.size, 16);
assert.equal(visibleTypes.size, 16);
const neutral = Object.fromEntries(test.questions.map(q => [q.id, 'neutral']));
const neutralResult = calculateFourAxisResult(test, neutral);
assert.equal(neutralResult.display_code, 'INFP');
assert.equal(neutralResult.personality_type, 'INFP');
assert.ok(neutralResult.preferences.every(axis => axis.resolution === 'fallback'));
assert.match(neutralResult.interpretation, /未测出倾向；默认赠送/);
assert.ok(neutralResult.preferences.every(axis => axis.close && axis.right_percent === 50));
assert.equal(neutralResult.questionnaire_version, 'naifrog-scenes-12-v8');
assert.match(presentShareText('奶蝶', true, false), /奶蝶.*默认赠送/);
assert.doesNotMatch(presentInterpretation(neutralResult.interpretation, neutralResult.preferences), /[A-Z]/);
const conservative = { ...test, typeResolution: undefined };
assert.equal(calculateFourAxisResult(conservative, neutral).display_code, 'XXXX');
// 非中间选择互相抵消时按固定题号决胜，两侧均覆盖；不受题目或选项数组顺序影响。
for (const score of [0, 1]) {
  const answers = { ...neutral };
  for (const axis of axes) {
    const questions = test.questions.filter(q => axis in q.options[0].scores).sort((a, b) => a.id.localeCompare(b.id));
    answers[questions[0].id] = questions[0].options.find(option => option.scores[axis] === score).id;
    answers[questions[1].id] = questions[1].options.find(option => option.scores[axis] === 1 - score).id;
  }
  const result = calculateFourAxisResult(test, answers);
  assert.equal(result.display_code, score === 0 ? 'ISTJ' : 'ENFP');
  assert.ok(result.preferences.every(axis => axis.resolution === 'tie_break' && axis.raw_total === 6 && axis.right_percent === 50));
  assert.doesNotMatch(presentInterpretation(result.interpretation, result.preferences), /[A-Z]/);
  result.preferences.forEach(axis => assert.match(presentAxisNote(axis, true), /平分/));
  assert.equal(rankFourAxisTypes(test, result)[0].personalityType.id, result.type_code);
  assert.deepEqual(calculateFourAxisResult({ ...test, questions: [...test.questions].reverse() }, answers), result);
}
assert.equal((neutralResult.interpretation.match(/左侧 0 次 · 中间 3 次 · 右侧 0 次/g) || []).length, 4);
// 正式展示使用题库固定顺序；计分必须始终按 ID，而非选项所在位置。
const originalQuestions = structuredClone(test.questions);
for (const offset of [0, 1, 2]) {
  const reordered = test.questions.map(question => ({ ...question,
    options: [...question.options.slice(offset), ...question.options.slice(0, offset)] }));
  reordered.forEach(question => {
    assert.ok(question.options.every(option => !/偏向 [AB]/.test(option.text)));
  });
  for (const optionId of ['a', 'neutral', 'b']) {
    const answers = Object.fromEntries(test.questions.map(question => [question.id, optionId]));
    assert.deepEqual(calculateFourAxisResult({ ...test, questions: reordered }, answers),
      calculateFourAxisResult(test, answers));
  }
}
assert.deepEqual(test.questions, originalQuestions);
console.log('PASS [v8旧版兼容]: 固定三选项、旧版字数约束、按ID计分、结果选择分布正确。');
neutralResult.preferences.forEach(axis => {
  assert.equal(axis.raw_total, 6);
  assert.equal(axis.raw_minimum, 3);
  assert.equal(axis.raw_maximum, 9);
  assert.equal(axis.item_count, 3);
  assert.match(presentAxisNote(axis, true), /未测出倾向/);
});
const invalid = structuredClone(test);
invalid.questions[0].options[0].scores.ei = Number.NaN;
assert.throws(() => calculateFourAxisResult(invalid, neutral), /强度必须/);
const missingAxis = { ...test, questions: test.questions.filter(q => !('ei' in q.options[0].scores)) };
assert.throws(() => calculateFourAxisResult(missingAxis, neutral), /必须配置题目/);
// 每轴单独扫描全部三档可达总分，确认中立、临界、两侧对称和极端。
for (const axis of axes) {
  const questions = test.questions.filter(q => axis in q.options[0].scores);
  for (let units = 0; units <= 6; units++) {
    const answers = { ...neutral };
    let remaining = units;
    for (const question of questions) {
      const score = Math.min(2, remaining) / 2;
      remaining -= score * 2;
      answers[question.id] = question.options.find(o => o.scores[axis] === score).id;
    }
    const result = calculateFourAxisResult(test, answers);
    const preference = result.preferences.find(p => p.dimension === axis);
    assert.equal(preference.right_percent, Math.round(units / 6 * 100));
    assert.equal(preference.close, Math.abs(units / 6 - 0.5) <= 0.15);
    assert.equal(result.display_code[axes.indexOf(axis)], preference.letter);
    assert.match(result.display_code, /^[IE][SN][TF][JP]$/);
    assert.equal(rankFourAxisTypes(test, result)[0].personalityType.id, result.type_code);
    if (units !== 3) assert.equal(preference.letter, units > 3 ? preference.right : preference.left);
    const oldResult = calculateFourAxisResult(conservative, answers);
    assert.equal(oldResult.display_code[axes.indexOf(axis)], preference.close ? 'X' : preference.letter);
  }
}
assert.throws(() => calculateFourAxisResult(test, {}), /完成所有题目/);
// 每个维度穷举三题全部27条三档路径，独立核对分数、平分决胜及默认赠送。
const defaults = ['I', 'N', 'F', 'P'];
let threeChoicePaths = 0;
for (const [index, axis] of axes.entries()) {
  const questions = test.questions.filter(q => q.scoringKey.scale === axis).sort((a, b) => a.id.localeCompare(b.id));
  for (let pattern = 0; pattern < 27; pattern++) {
    let digits = pattern;
    const votes = questions.map(() => { const vote = digits % 3; digits = Math.floor(digits / 3); return vote; });
    const answers = { ...neutral };
    questions.forEach((question, i) => { answers[question.id] = question.options.find(option => option.scores[axis] === votes[i] / 2).id; });
    const result = calculateFourAxisResult(test, answers);
    const preference = result.preferences[index];
    const units = votes.reduce((sum, vote) => sum + vote, 0);
    const firstNonNeutral = votes.find(vote => vote !== 1);
    const expectedLetter = units > 3 ? preference.right : units < 3 ? preference.left
      : firstNonNeutral === undefined ? defaults[index] : firstNonNeutral === 2 ? preference.right : preference.left;
    assert.equal(preference.raw_total, 3 + units);
    assert.equal(preference.right_percent, Math.round(units / 6 * 100));
    assert.equal(preference.letter, expectedLetter);
    assert.equal(preference.resolution, units !== 3 ? 'majority' : firstNonNeutral === undefined ? 'fallback' : 'tie_break');
    assert.doesNotMatch(presentInterpretation(result.interpretation, result.preferences), /[A-Z]/);
    threeChoicePaths++;
  }
}
console.log(`PASS [v8旧版兼容]: ${threeChoicePaths} 条单轴完整三档路径，独立验证总分、平分、赠送和中文展示。`);
const protocol = new TestProtocol();
protocol.registerTest(test);
protocol.startTest(test.id);
assert.throws(() => protocol.submitAnswer('missing', 'a'), /不存在/);
assert.throws(() => protocol.submitAnswer('q01', 'bad'), /不存在/);
assert.throws(() => protocol.getResult(), /完成所有题目/);
test.questions.forEach(q => protocol.submitAnswer(q.id, 'a'));
const first = protocol.getResult();
protocol.submitAnswer('q01', 'b');
assert.notDeepEqual(protocol.getResult().preferences[0], first.preferences[0]);
protocol.submitAnswer('q01', 'a');
assert.deepEqual(protocol.getResult(), first);
const detailed = protocol.getDetailedResult();
assert.equal(detailed.topMatches[0].personalityType.id, first.type_code);
assert.equal(detailed.isHybrid, first.preferences.some(p => p.close));
test.questions.forEach(q => protocol.submitAnswer(q.id, 'neutral'));
assert.equal(protocol.getDetailedResult().display_code, 'INFP');
assert.deepEqual(protocol.getDetailedResult().dominantTraits, []);
protocol.resetTest();
assert.throws(() => protocol.getResult(), /No test started/);
protocol.startTest(test.id);
assert.throws(() => protocol.getResult(), /完成所有题目/);

// 无 scoringMode 的旧配置仍走原算法，接口字段与原归一化范围不变。
const legacy = new TestProtocol();
legacy.registerTest({ id: 'legacy', name: '旧主题', description: '', dimensions: [{ id: 'd', name: '维度', description: '', min_label: '', max_label: '' }], questions: [{ id: 'q', text: '', type: 'multiple_choice', options: [{ id: 'a', text: '', scores: { d: 1 } }] }], personalityTypes: [{ id: 'old', name: '旧类型', description: '旧结果', meme: '', template: { d: 3 } }] });
legacy.startTest('legacy');
legacy.submitAnswer('q', 'a');
assert.equal(legacy.getResult().personality_type, 'old');
assert.equal(legacy.getResult().dimensions.d, 3);
assert.equal(legacy.getResult().type_code, undefined);
console.log(`PASS [v8旧版兼容]: ${checked} 两端票数组合；28种三档单轴总分；16/16类型可达；取名与图片、隐藏编码、平分决胜、全中间披露、改答和旧配置兼容。`);
