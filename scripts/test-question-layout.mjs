import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parse, compileScript } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as vue from 'vue';
import { naifrogTest as test } from '../src/instance/naifrogTest.ts';
import { LoadingBarrage } from './test-loading-barrage.mjs';
import { createQuestionNotes } from '../src/core/questionMeme.ts';
import reviews from '../src/instance/naifrog-abstract-reviews.json' with { type: 'json' };

const source = fs.readFileSync(new URL('../src/views/Test.vue', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/views/Home.vue', import.meta.url), 'utf8');
assert.doesNotMatch(home, /<span class="nursery-badge">纯种奶蛙鉴赏/);
assert.match(home, /class="official-site-link" href="https:\/\/oddtwin\.fun\/">跳转官网<\/a>/);
for (const value of [0, 0.5, 0.9999, NaN]) {
  const notes = createQuestionNotes(test.questions.map(q => q.id), () => value);
  assert.equal(Object.keys(notes).length, 12);
  assert.equal(new Set(Object.values(notes)).size, 12, '一轮12题短评不重复');
  for (const note of Object.values(notes)) assert.ok(reviews.includes(note));
}
assert.deepEqual(createQuestionNotes([]), {});
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'question-layout-test', inlineTemplate: true });
const compiled = ts.transpileModule(script.content,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const loadingCompiled = ts.transpileModule(script.content.replace('const showDistillation = ref(false);', 'const showDistillation = ref(true);'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const readyCompiled = ts.transpileModule(script.content.replace('const showDistillation = ref(false);', 'const showDistillation = ref(true);')
  .replace('const isResultReady = ref(false);', 'const isResultReady = ref(true);'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
export const questionStyles = descriptor.styles.map(style => style.content).join('\n');

/** 用实际问卷和组件生成测试HTML；不启动网络服务、不运行页面交互或改变答案。 */
export async function renderQuestion(question, index = 0, { loading = false, ready = false } = {}) {
  const store = { currentQuestion: question, currentQuestionIndex: index, isLastQuestion: false,
    totalQuestions: test.questions.length, progress: 0, currentTheme: test, isTestStarted: true, answers: {} };
  const pixel = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=';
  const dependencies = { vue, echarts: {}, 'echarts-liquidfill': {},
    '../core/questionMeme': { createQuestionNotes },
    '../components/LoadingBarrage.vue': LoadingBarrage,
    'vue-router': { useRouter: () => ({ push() {}, replace() {} }) },
    '../stores/testStore': { useTestStore: () => store },
    '../assets/mascotAssets': { mascotAssets: { curious: pixel, eye: pixel } } };
  const module = { exports: {} };
  vm.runInNewContext(ready ? readyCompiled : loading ? loadingCompiled : compiled, { module, exports: module.exports, console, clearTimeout, clearInterval,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; }
  });
  const context = {};
  const html = await renderToString(vue.createSSRApp(module.exports.default), context);
  return html + (context.teleports?.body ?? '');
}

for (const [index, question] of test.questions.entries()) {
  const html = await renderQuestion(question, index);
  assert.ok(html.includes('奶族身份确认中'));
  const note = html.slice(html.indexOf('class="frog-question-note"'), html.indexOf('class="question-wrapper"'));
  assert.ok(reviews.some(review => note.includes(review)), '题目前的小文字必须来自审核短评库');
  assert.doesNotMatch(note, /选好自动下一题|没有恋爱经历/);
  const metaStart = html.indexOf('class="question-meta"');
  const headingStart = html.indexOf('class="q-text"');
  assert.ok(metaStart >= 0 && metaStart < headingStart, '题号与场景须在题干前共用布局');
  const meta = html.slice(metaStart, headingStart);
  assert.ok(meta.includes(`Q${index + 1}`));
  assert.ok(meta.includes(`class="question-scene-label">${question.scene}`));
  assert.ok(meta.includes(`class="question-scene-title">${question.title}`));
  assert.ok(html.includes(question.text));
  question.options.forEach(option => assert.ok(html.includes(option.text)));
}
const legacy = { ...test.questions[0], scene: undefined, title: undefined };
assert.ok(!(await renderQuestion(legacy)).includes('class="question-scene"'));
console.log('PASS: 12题题号/场景/标题布局，原题干与选项保留，旧题库无场景兼容。');
