import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compileScript, parse } from '@vue/compiler-sfc';
import * as vue from 'vue';
import { createQuestionNotes } from '../src/core/questionMeme.ts';

// 在隔离的Vue渲染器中执行真实script setup，模拟路由和时钟，不依赖浏览器或网络。
function createClock() {
  let id = 0;
  const timers = new Map();
  const frames = new Map();
  return {
    timers, frames,
    setTimeout: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
    setInterval: (fn, delay) => { timers.set(++id, { fn, delay }); return id; },
    clearTimeout: key => timers.delete(key),
    clearInterval: key => timers.delete(key),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; },
    cancelAnimationFrame: key => frames.delete(key),
    runDelay(delay) {
      for (const [key, task] of [...timers]) {
        if (task.delay !== delay) continue;
        timers.delete(key);
        task.fn();
      }
    }
  };
}

function makeStore() {
  return vue.reactive({
    isTestStarted: true, isTestCompleted: false, result: null, currentQuestionIndex: 0,
    currentTheme: { name: '测试', questions: [{ id: 'q01', options: [{ id: 'a' }, { id: 'b' }] }] },
    answers: {}, totalQuestions: 1, progress: 0,
    get currentQuestion() { return this.currentTheme.questions[this.currentQuestionIndex] ?? null; },
    get isLastQuestion() { return this.currentQuestionIndex === this.totalQuestions - 1; },
    submitAnswer(option) { this.answers[this.currentQuestion.id] = option; this.currentQuestionIndex++; },
    completeTest() { this.isTestCompleted = true; this.result = { personality_type: 'INFP' }; },
    resetTest() { this.isTestStarted = false; this.currentQuestionIndex = 0; this.result = null; this.answers = {}; },
    goToPreviousQuestion() { this.currentQuestionIndex--; }
  });
}

function mountTest(store, pushResult = () => undefined) {
  const clock = createClock();
  const navigation = [];
  const router = { push: path => { navigation.push(path); return pushResult(); }, replace: path => navigation.push(path) };
  const chart = { setOption() {}, dispose() {} };
  const source = fs.readFileSync(new URL('../src/views/Test.vue', import.meta.url), 'utf8');
  const { descriptor } = parse(source);
  const script = compileScript(descriptor, { id: 'lifecycle-test' });
  const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  const dependencies = { vue, 'vue-router': { useRouter: () => router }, '../stores/testStore': { useTestStore: () => store },
    '../assets/ads/ahui-poster.webp': '/ahui-poster.webp',
    '../core/questionMeme': { createQuestionNotes },
    '../assets/mascotAssets': { mascotAssets: {} }, '../components/LoadingBarrage.vue': { render: () => null },
    echarts: { init: () => chart }, 'echarts-liquidfill': {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, ...clock,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name]; },
    confirm: () => true, console });
  const renderer = vue.createRenderer({
    createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
    insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {},
    parentNode: () => null, nextSibling: () => null
  });
  const component = module.exports.default;
  component.render = () => null;
  const app = renderer.createApp(component);
  const instance = app.mount({});
  return { clock, navigation, state: instance.$.setupState, unmount: () => app.unmount() };
}

// 结果页返回答题页：已完成状态必须回结果页，不能停在没有题目的加载页。
const completed = makeStore();
completed.isTestCompleted = true;
completed.result = { personality_type: 'INFP' };
completed.currentQuestionIndex = 1;
const back = mountTest(completed);
assert.deepEqual(back.navigation, ['/result']);
back.unmount();

// 最后一题已经提交但生成动画被路由中断：重入时恢复生成，不丢答案。
const interrupted = makeStore();
interrupted.submitAnswer('a');
const resume = mountTest(interrupted);
assert.equal(interrupted.isTestCompleted, true);
assert.deepEqual(resume.navigation, ['/result']);
assert.equal(interrupted.answers.q01, 'a');
resume.unmount();

// 返回已经答过的题保留选项，但不能自行开启新的自动提交计时器。
const revisiting = makeStore();
revisiting.answers.q01 = 'b';
const previous = mountTest(revisiting);
assert.equal(previous.state.selectedOption, 'b');
assert.deepEqual(previous.navigation, []);
assert.equal(previous.clock.timers.size, 0);
previous.unmount();

// 首次选择确定提交时间，改选只更新答案，不延长450毫秒等待。
const changing = makeStore();
const selection = mountTest(changing);
const originalNote = selection.state.questionNote;
const event = { currentTarget: { closest: () => ({ dataset: { questionId: 'q01' } }) } };
selection.state.selectOption('a', event);
assert.equal(selection.state.questionNote, originalNote, '改选不得刷新短评');
const deadline = [...selection.clock.timers.keys()];
selection.state.selectOption('b', event);
assert.deepEqual([...selection.clock.timers.keys()], deadline);
selection.clock.runDelay(450);
assert.equal(changing.answers.q01, 'b');
selection.unmount();
await vue.nextTick();
await vue.nextTick();
assert.equal(selection.clock.timers.size, 0);

// 未开始和不完整的异常状态回首页，不伪造结果。
// 同名选项ID跨题复用也不能默认选中；仅返回已答题时恢复真实答案。
const nextStore = makeStore();
nextStore.currentTheme.questions.push({ id: 'q02', options: [{ id: 'a' }, { id: 'b' }] });
nextStore.totalQuestions = 2;
const fresh = mountTest(nextStore);
fresh.state.selectOption('a', event);
fresh.clock.runDelay(450);
assert.equal(nextStore.currentQuestion.id, 'q02');
assert.equal(fresh.state.selectedOption, null);
assert.equal(nextStore.answers.q02, undefined);
fresh.state.isQuestionTransitioning = false;
fresh.state.goToPreviousQuestion();
assert.equal(fresh.state.selectedOption, 'a');
fresh.unmount();

for (const started of [true, false]) {
  const invalid = makeStore();
  invalid.isTestStarted = started;
  invalid.currentQuestionIndex = 1;
  const mounted = mountTest(invalid);
  assert.deepEqual(mounted.navigation, ['/']);
  assert.equal(invalid.isTestCompleted, false);
  mounted.unmount();
}

// 弹幕使用CSS，无额外图表/帧任务；退出时释放解锁按钮的延迟任务。
for (const phase of ['before-next-tick', 'after-next-tick', 'after-ready']) {
  const mounted = mountTest(makeStore());
  mounted.state.selectedOption = 'a';
  mounted.state.startDistillation();
  assert.ok([...mounted.clock.timers.values()].some(timer => timer.delay === 5000), '判定页应按最新要求停留5秒');
  if (phase === 'before-next-tick') mounted.unmount();
  await vue.nextTick();
  await vue.nextTick();
  if (phase === 'after-ready') mounted.clock.runDelay(5000);
  assert.equal(mounted.clock.frames.size, 0, '移除烧瓶后不再创建图表动画帧');
  if (phase !== 'before-next-tick') mounted.unmount();
  await vue.nextTick();
  assert.equal(mounted.clock.timers.size, 0, `${phase}: 遗留定时器`);
  assert.equal(mounted.clock.frames.size, 0, `${phase}: 遗留动画帧`);
}
// 五秒仅解锁按钮，不自动跳转；提前调用无效，点击一次才计算，连点不能重复导航。
const waitingStore = makeStore();
const waiting = mountTest(waitingStore);
waiting.state.selectedOption = 'a';
waiting.state.startDistillation();
await waiting.state.goToResult();
assert.deepEqual(waiting.navigation, []);
waiting.clock.runDelay(4999);
assert.equal(waitingStore.isTestCompleted, false);
assert.deepEqual(waiting.navigation, []);
waiting.clock.runDelay(5000);
assert.equal(waitingStore.isTestCompleted, false);
assert.equal(waiting.state.isResultReady, true);
assert.deepEqual(waiting.navigation, []);
const opening = waiting.state.goToResult();
await waiting.state.goToResult();
await opening;
assert.equal(waitingStore.isTestCompleted, true);
waiting.clock.runDelay(5000);
assert.deepEqual(waiting.navigation, ['/result']);
waiting.unmount();
await vue.nextTick();
await vue.nextTick();
assert.equal(waiting.clock.timers.size, 0);
// 导航拒绝后恢复可点状态，已算出的结果复用，不重复计算。
const retryStore = makeStore();
let computations = 0, attempts = 0;
const complete = retryStore.completeTest.bind(retryStore);
retryStore.completeTest = () => { computations++; complete(); };
const retry = mountTest(retryStore, () => ++attempts === 1 ? Promise.reject(new Error('模拟导航失败')) : Promise.resolve());
retry.state.selectedOption = 'a';
retry.state.startDistillation();
retry.clock.runDelay(5000);
await retry.state.goToResult();
assert.equal(retry.state.isOpeningResult, false);
assert.ok(retry.state.resultOpenError);
await retry.state.goToResult();
assert.equal(computations, 1);
assert.equal(attempts, 2);
assert.equal(retry.state.resultOpenError, '');
retry.unmount();
console.log('PASS: 结果页恢复、回显改选、5秒仅解锁/点击查看/连点隔离与退出任务释放。');
