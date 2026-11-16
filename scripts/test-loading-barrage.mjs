import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import * as vue from 'vue';
import { parse, compileScript } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as core from '../src/core/loadingBarrage.ts';

const config = JSON.parse(fs.readFileSync(new URL('../src/instance/loading-barrage.json', import.meta.url), 'utf8'));
const { descriptor } = parse(fs.readFileSync(new URL('../src/components/LoadingBarrage.vue', import.meta.url), 'utf8'));
const script = compileScript(descriptor, { id: 'barrage-test', inlineTemplate: true });
const compiled = ts.transpileModule(script.content, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const module = { exports: {} };
vm.runInNewContext(compiled, { module, exports: module.exports, Math,
  require(name) {
    if (name === 'vue') return vue;
    if (name === '../instance/loading-barrage.json') return config;
    if (name === '../core/loadingBarrage') return core;
    throw new Error(`Unexpected import ${name}`);
  }
});
export const LoadingBarrage = module.exports.default;
export const barrageStyles = descriptor.styles.map(style => style.content).join('\n');
const entries = core.normalizeBarrage(config);
assert.equal(entries.length, 11);
for (const invalid of [null, {}, { enabled: false, entries: config.entries }]) assert.deepEqual(core.normalizeBarrage(invalid), []);
for (const invalid of [{ Name: '' }, { Name: '蛙'.repeat(25) }, { type_id: 3 }, { amount: 0 }, { amount: -1 }, { amount: 1.5 }, { amount: 10000 }]) {
  assert.deepEqual(core.normalizeBarrage({ enabled: true, entries: [{ ...entries[0], ...invalid }] }), []);
}
assert.equal(core.normalizeBarrage({ enabled: true, entries: Array(100).fill(entries[0]) }).length, 60);
assert.deepEqual(core.createBarrageFrames([]), []);
for (const offset of [0, 4, -1, NaN, Infinity]) {
  const frames = core.createBarrageFrames(entries, offset);
  assert.equal(frames.length, 11);
  assert.equal(new Set(frames.map(frame => frame.Name)).size, 11);
  for (const frame of frames) assert.ok(frame.delay + frame.duration <= 5000);
  assert.equal(new Set(frames.map(frame => `${frame.fromX},${frame.fromY}`)).size, 6);
  assert.ok(frames.every((frame, i) => frame.delay === i * 260));
  assert.ok(frames.every(frame => frame.cycle === 3360 && frame.duration / frame.cycle === 0.625));
}
const bounded = core.createBarrageFrames(Array(60).fill(entries[0]));
assert.equal(bounded.length, 12);
assert.ok(bounded.every(frame => frame.delay + frame.duration <= 5000));
const html = await renderToString(vue.createSSRApp(LoadingBarrage));
assert.doesNotMatch(html, /barrage-heading|趣味弹幕 · 演示/);
assert.match(html, /配置内容展示，不代表真实交易/);
assert.equal((html.match(/class="barrage-chip/g) ?? []).length, 11);
assert.doesNotMatch(html, /<a\b|<script\b|onclick=|v-html/);
assert.match(barrageStyles, /prefers-reduced-motion/);
assert.match(barrageStyles, /\.barrage-later \{ display: none/);
assert.match(barrageStyles, /100% \{ opacity: 0; transform: translate\(0, 0\)/);
assert.match(barrageStyles, /var\(--delay\) infinite both/);
console.log('PASS: 弹幕配置校验、最多12条/六方向错峰汇聚、同点淡出、5秒边界与减弱动态。');
