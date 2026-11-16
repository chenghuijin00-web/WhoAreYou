import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compileScript, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as vue from 'vue';
import { naifrogTest as test } from '../src/instance/naifrogTest.ts';
import { calculateFourAxisResult } from '../src/core/fourAxis.ts';
import * as presentation from '../src/core/resultPresentation.ts';
import * as relationModule from '../src/core/frogRelations.ts';
import * as shareModule from '../src/core/resultShare.ts';
import { useResultShare } from '../src/components/useResultShare.ts';

const source = fs.readFileSync(new URL('../src/views/Result.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'result-layout-regression', inlineTemplate: true });
const compiled = ts.transpileModule(script.content.replaceAll('import.meta.env.BASE_URL', JSON.stringify('/PMD/')),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

export const resultStyles = descriptor.styles.map(style => style.content).join('\n').replace(/:deep\(([^)]+)\)/g, '$1');
export async function renderResult(result, { assetUrls } = {}) {
  const store = { result, currentTheme: test, isTestCompleted: true, resetTest() {} };
  const image = { props: ['src', 'alt'], setup: props => () => vue.h('img', { src: props.src, alt: props.alt }) };
  const dependencies = {
    vue, 'vue-router': { useRouter: () => ({ push() {} }), RouterLink: { props: ['to'], setup: (props, { slots }) => () => vue.h('a', { href: props.to }, slots.default?.()) } }, echarts: {},
    '../assets/mascotAssets': { mascotAssets: { curious: '/fallback.webp' } },
    '../assets/personaAssets': { getPersonaImage: code => assetUrls?.[code] ?? `/assets/${code.toLowerCase()}.webp` },
    '../core/resultPresentation': presentation,
    '../core/resultShare': shareModule,
    '../components/useResultShare': { useResultShare },
    '../core/frogRelations': relationModule,
    '../components/ProgressiveImage.vue': image,
    '../components/ResultPosterButton.vue': { props: ['data'], setup: props => () => vue.h('button', { class: 'poster-trigger', 'data-poster-meme': props.data.character.meme, 'data-entry-url': props.data.entryUrl }, '生成海报') },
    '../stores/testStore': { useTestStore: () => store }
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, console,
    require(name) { if (!(name in dependencies)) throw new Error(`Unexpected import ${name}`); return dependencies[name]; }
  });
  return renderToString(vue.createSSRApp(module.exports.default));
}

function assertSimplified(html, persona) {
  for (const removed of ['你的四组偏好', '本次作答解读', '浏览 16 种原创奶蛙皮肤',
    '本次领取的娱乐皮肤，不是对你整个人的定论', '本次更接近的娱乐皮肤，不是对你整个人的定论',
    '部分维度的回答未提供明确方向', '你的作答倾向见下方', '你这次的作答倾向见下方',
    '你是什么东西 · 测试结果', '本次奶蛙皮肤 · 仅供娱乐']) {
    assert.ok(!html.includes(removed), `仍显示${removed}`);
  }
  assert.doesNotMatch(html, /class="frog-preferences"|<details/);
  assert.ok(html.includes(persona.name));
  assert.match(html, /class="personality-identity">你的身份是：<\/p>/);
  assert.ok(html.indexOf('class="personality-identity"') < html.indexOf('class="personality-name"'), '身份提示应在角色名称上方');
  assert.ok(html.includes(persona.meme));
  assert.ok(html.includes('你的奶蛙评语'));
  for (const paragraph of persona.description.split('\n\n')) assert.ok(html.includes(paragraph));
  for (const tag of persona.tags ?? []) assert.ok(html.includes(tag));
  assert.ok(html.includes(`/assets/${persona.id.toLowerCase()}.webp`));
  assert.ok(html.includes('奶蛙世界整活搭配，与现实朋友关系无关'));
  const related = relationModule.getFrogRelations(persona.id, test.personalityTypes);
  assert.ok(html.includes(relationModule.FROG_RELATION_LABELS.fakeFriend));
  assert.ok(html.includes(relationModule.FROG_RELATION_LABELS.confidant));
  assert.ok(html.includes(related.fakeFriend.name) && html.includes(related.confidant.name));
  assert.equal((html.match(/class="frog-relation-person"/g) ?? []).length, 4);
  assert.ok(html.indexOf('result-overview-actions') < html.indexOf('frog-persona-review-title'));
  assert.match(html, /result-compact/);
  assert.match(html, /href="\/team"[^>]*>合作<\/a>/);
  const header = html.slice(html.indexOf('class="result-header"'), html.indexOf('class="personality-card-section"'));
  assert.doesNotMatch(header, /class="share-btn"/);
  assert.match(html, /class="meme-refresh-btn"/);
  assert.match(html, /aria-label="换一句短评"/);
  assert.equal((html.match(/class="frog-relation-card"/g) ?? []).length, 2);
  assert.equal((html.match(/class="poster-trigger"/g) ?? []).length, 1);
  assert.equal((html.match(/class="invite-share-btn"/g) ?? []).length, 1);
  assert.ok(html.includes('测测其他人'));
  assert.ok(html.indexOf('class="invite-share-btn"') > html.indexOf('class="poster-trigger"'));
  assert.ok(html.indexOf('class="result-overview"') < html.indexOf('class="frog-relations"'));
  for (const other of [...related.fakeFriends, ...related.confidants]) {
    assert.ok(html.includes(other.name));
    assert.ok(html.includes(`/assets/${other.id.toLowerCase()}.webp`));
  }
  assert.ok(html.includes('生成海报'));
  assert.ok(html.includes('data-entry-url="https://whoareyou-naifrog.pages.dev/"'), '海报必须指向正式入口');
  assert.ok(html.includes('重新蒸馏') && html.includes('分享结果'));
}

const axisIndex = { ei: 0, sn: 1, tf: 2, jp: 3 };
const rightLetters = ['E', 'N', 'F', 'P'];
for (const persona of test.personalityTypes) {
  const answers = Object.fromEntries(test.questions.map(question => {
    const axis = Object.keys(question.options[0].scores)[0];
    const right = persona.id[axisIndex[axis]] === rightLetters[axisIndex[axis]];
    const selected = [...question.options].sort((a, b) => (right ? -1 : 1) * (a.scores[axis] - b.scores[axis]))[0];
    return [question.id, selected.id];
  }));
  const result = calculateFourAxisResult(test, answers);
  assert.equal(result.personality_type, persona.id);
  assertSimplified(await renderResult(result), persona);
}
const noDirection = Object.fromEntries(test.questions.map(q => [q.id, q.options.find(o => Object.values(o.scores).every(s => s === 0.5)).id]));
const fallback = calculateFourAxisResult(test, noDirection);
assert.ok(fallback.preferences.every(axis => axis.resolution === 'fallback'));
assertSimplified(await renderResult(fallback), test.personalityTypes.find(p => p.id === fallback.personality_type));
for (const persona of test.personalityTypes) {
  for (const meme of persona.memeVariants) {
    const html = await renderResult({ ...fallback, personality_type: persona.id, display_meme: meme });
    assert.ok(html.includes(`aria-atomic="true">${meme}</p>`));
    assert.ok(html.includes(`data-poster-meme="${meme}"`), '海报必须沿用页面同一条短评');
  }
}
console.log('PASS: 16种结果及默认赠送页面均删除指定区块，角色主图/名称/金句/评语/标签操作保留。');
