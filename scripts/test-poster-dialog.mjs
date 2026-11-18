import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { parse, compileScript } from '@vue/compiler-sfc';
import * as vue from 'vue';

const source = fs.readFileSync(new URL('../src/components/ResultPosterButton.vue', import.meta.url), 'utf8');
const script = compileScript(parse(source).descriptor, { id: 'poster-dialog-regression' });
const compiled = ts.transpileModule(script.content,
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const jobs = [], revoked = [], created = [];
const readers = [];
let delayRead = false;
class PreviewReader {
  constructor() { readers.push(this); }
  readAsDataURL() { this.result = 'data:image/png;base64,cG9zdGVy'; if (!delayRead) this.onload?.(); }
  abort() { this.onabort?.(); }
}
const usage = [];
const dependencies = { vue, '../core/usageTracking': { trackUsage: event => usage.push(event) }, '../core/resultPoster': {
  createResultPoster(data, signal) { return new Promise((resolve, reject) => jobs.push({ resolve, reject, signal, data })); }
} };
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, console, AbortController, FileReader: PreviewReader, DOMException,
  URL: { createObjectURL() { const url = `blob:poster-${created.length}`; created.push(url); return url; }, revokeObjectURL(url) { revoked.push(url); } },
  require(name) { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }
});
const renderer = vue.createRenderer({ createElement: () => ({}), createText: () => ({}), createComment: () => ({}),
  insert() {}, remove() {}, setText() {}, setElementText() {}, patchProp() {}, parentNode: () => null, nextSibling: () => null });
const component = module.exports.default;
component.render = () => null;
const app = renderer.createApp(component, { data: { character: { name: '奶sir' } } });
const instance = app.mount({});
const state = instance.$.setupState;
const dialog = { open: false, showModal() { this.open = true; }, close() { this.open = false; } };
state.dialog = dialog;
const flush = async () => { await vue.nextTick(); await vue.nextTick(); };

const first = state.openPoster(); await flush();
assert.equal(jobs.length, 1);
await state.openPoster();
assert.equal(jobs.length, 1, '重复点击不得创建第二次生成');
state.closePoster();
assert.equal(jobs[0].signal.aborted, true);
const second = state.openPoster(); await flush();
assert.equal(jobs.length, 2);
jobs[0].reject(new Error('old image cancelled')); await first;
assert.equal(jobs[1].signal.aborted, false, '旧任务失败不得取消新任务');
jobs[1].resolve(new Blob(['poster'], { type: 'image/png' })); await second;
assert.equal(state.previewUrl, 'data:image/png;base64,cG9zdGVy');
assert.equal(state.generating, false);
assert.equal(dialog.open, true);
state.closePoster();
assert.deepEqual(revoked, []);
assert.equal(dialog.open, false);

const failure = state.openPoster(); await flush();
jobs[2].reject(new Error('load failed')); await failure;
assert.ok(state.error);
assert.equal(state.generating, false);
const retry = state.openPoster(); await flush();
assert.equal(state.error, '');
jobs[3].resolve(new Blob(['retry'], { type: 'image/png' })); await retry;
assert.equal(state.previewUrl, 'data:image/png;base64,cG9zdGVy');
state.closePoster();
assert.equal(state.previewUrl, '');
delayRead = true;
const cancelRead = new AbortController();
const pendingRead = state.readPreview(new Blob(['poster']), cancelRead.signal);
cancelRead.abort();
await assert.rejects(pendingRead, { name: 'AbortError' });
assert.equal(readers.at(-1).onload, null, '取消读取后释放事件处理器');
delayRead = false;
const leaving = state.openPoster(); await flush();
app.unmount();
assert.equal(jobs[4].signal.aborted, true);
jobs[4].resolve(new Blob(['late'], { type: 'image/png' })); await leaving;
assert.equal(created.length, 0, '长按原图无需创建下载用的Blob地址');
assert.deepEqual(usage, ['poster_generated', 'poster_generated'], '只统计成功交付预览，不统计取消或失败');
assert.deepEqual(revoked, created);
assert.match(source, /-webkit-touch-callout: default/);
assert.match(source, /长按海报保存原图/);
assert.doesNotMatch(source, /你的奶蛙海报|下载图片|打开原图|如未出现菜单|下载通常进入/);
assert.match(source, /aria-label="海报原图预览"/);
console.log('PASS: 仅长按原图/关闭/简短提示，读取取消、防重复生成、重试/旧任务隔离及卸载清理。');
