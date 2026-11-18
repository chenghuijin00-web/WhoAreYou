import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as pinia from 'pinia';
import { naifrogTest as test } from '../src/instance/naifrogTest.ts';
import { selectPersonaMeme } from '../src/core/personaMeme.ts';
import { presentShareText } from '../src/core/resultPresentation.ts';
import approved from '../src/instance/naifrog-abstract-reviews.json' with { type: 'json' };

const before = structuredClone(test.personalityTypes);
assert.equal(test.personalityTypes.length, 16);
const all = test.personalityTypes.flatMap(persona => persona.memeVariants);
assert.equal(approved.length, 105);
assert.equal(new Set(approved).size, 105);
assert.equal(all.length, 16 * approved.length);
assert.equal(new Set(all).size, 105);
for (const persona of test.personalityTypes) {
  assert.deepEqual(persona.memeVariants, approved);
  assert.ok(approved.includes(persona.meme));
  assert.ok(persona.memeVariants.every(text => text.length > 0 && text.length <= 80 && text.endsWith('。')));
  for (let i = 0; i < approved.length; i++) assert.equal(selectPersonaMeme(persona, () => (i + 0.5) / approved.length), approved[i]);
  assert.equal(selectPersonaMeme(persona, () => 1), approved.at(-1));
  for (const value of [NaN, Infinity, -1]) assert.equal(selectPersonaMeme(persona, () => value), approved[0]);
}
assert.deepEqual(test.personalityTypes, before);
assert.equal(selectPersonaMeme(undefined), '');
assert.equal(selectPersonaMeme({ ...before[0], memeVariants: undefined }), before[0].meme);
assert.equal(selectPersonaMeme({ ...before[0], memeVariants: [] }), before[0].meme);
assert.equal(selectPersonaMeme({ ...before[0], memeVariants: ['', '  '] }), before[0].meme);
for (const previous of approved) {
  for (const value of [0, 0.5, 1]) assert.notEqual(selectPersonaMeme(before[0], () => value, previous), previous);
}
assert.equal(selectPersonaMeme({ ...before[0], memeVariants: ['唯一一句'] }, () => 0, '唯一一句'), '唯一一句');

// 执行真实Store动作，隔离计分引擎，仅验证完成时抽取及重入/重测边界；计分另有独立回归测试。
let currentTheme = test, code = test.personalityTypes[0].id, randomValue = 0;
let calculations = 0, draws = 0;
class Engine {
  registerTest() {} startTest() {} resetTest() {} submitAnswer() {}
  getResult() { calculations++; return { personality_type: code, match_percentage: 100, dimensions: {}, radar_chart: [], interpretation: '' }; }
}
const compiled = ts.transpileModule(fs.readFileSync(new URL('../src/stores/testStore.ts', import.meta.url), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
const trackedUsage = [];
const dependencies = { pinia, '../core/testEngine': { TestEngine: Engine },
  '../core/usageTracking': { trackUsage: event => trackedUsage.push(event) },
  '../xbti/themeManager': { themeManager: { getTheme: () => currentTheme } },
  '../core/personaMeme': { selectPersonaMeme: (persona, _random, previous) => { draws++; return selectPersonaMeme(persona, () => randomValue, previous); } } };
vm.runInNewContext(compiled, { module, exports: module.exports,
  require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; } });
const useStore = module.exports.useTestStore;
for (const persona of test.personalityTypes) {
  for (let i = 0; i < approved.length; i++) {
    pinia.setActivePinia(pinia.createPinia());
    code = persona.id; randomValue = (i + 0.5) / approved.length; calculations = draws = 0;
    const store = useStore();
    store.completeTest();
    assert.equal(calculations, 0, '未开始不能生成');
    store.currentThemeId = test.id; store.startTest(); store.completeTest();
    assert.equal(store.result.display_meme, persona.memeVariants[i]);
    randomValue = 1 - 0.5 / approved.length;
    store.completeTest();
    assert.equal(draws, 1); assert.equal(calculations, 1);
    assert.equal(store.result.display_meme, persona.memeVariants[i], '重入/重复完成不能换短评');
    const share = presentShareText(persona.name, false, false, store.result.display_meme);
    assert.ok(share.includes(store.result.display_meme));
    store.startTest(); assert.equal(store.result, null);
    store.completeTest();
    assert.equal(draws, 2); assert.equal(store.result.display_meme, approved.at(-1));
    if (i === 0) {
      const original = JSON.parse(JSON.stringify(store.result));
      const originalAnswers = JSON.stringify(store.answers);
      const count = calculations;
      for (let click = 0; click < 5; click++) {
        const previous = store.result.display_meme;
        store.refreshMeme();
        assert.notEqual(store.result.display_meme, previous);
        assert.ok(approved.includes(store.result.display_meme));
        assert.deepEqual({ ...JSON.parse(JSON.stringify(store.result)), display_meme: original.display_meme }, original);
        assert.ok(presentShareText(persona.name, false, false, store.result.display_meme).includes(store.result.display_meme));
      }
      assert.equal(calculations, count, '刷新短评不得重新计分');
      assert.equal(JSON.stringify(store.answers), originalAnswers);
    }
    store.resetTest(); assert.equal(store.result, null);
    store.refreshMeme(); assert.equal(store.result, null);
    store.$dispose();
  }
}
currentTheme = structuredClone(test);
currentTheme.personalityTypes.forEach(persona => { delete persona.memeVariants; });
pinia.setActivePinia(pinia.createPinia());
const legacy = useStore(); legacy.currentThemeId = test.id; legacy.startTest(); legacy.completeTest();
assert.equal('display_meme' in legacy.result, false, '旧主题结果字段保持原样');
legacy.refreshMeme();
assert.equal('display_meme' in legacy.result, false, '没有文案池的旧主题不能刷新');
legacy.$dispose();

// 下次开始和最后一题提交分别计一次；重复提交、重开结果、半途退出不再计为完成。
trackedUsage.length = 0;
pinia.setActivePinia(pinia.createPinia());
const measured = useStore();
measured.startTest();
assert.deepEqual(trackedUsage, []);
measured.setTheme(test.id);
measured.startTest();
measured.submitAnswer(test.questions[0].options[0].id);
measured.resetTest();
assert.deepEqual(trackedUsage, ['test_start']);
measured.startTest();
for (const question of test.questions) measured.submitAnswer(question.options[0].id);
measured.submitAnswer(test.questions.at(-1).options[0].id);
measured.completeTest();
measured.completeTest();
assert.deepEqual(trackedUsage, ['test_start', 'test_start', 'test_finish']);
measured.$dispose();
console.log('PASS: 16型共享105句审核原文、1680个随机分支、单次锁定、重测重抽、分享一致及旧主题兼容。');
