import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import { compileScript, parse } from '@vue/compiler-sfc';
import { renderToString } from '@vue/server-renderer';
import * as vue from 'vue';

const source = fs.readFileSync(new URL('../src/views/Team.vue', import.meta.url), 'utf8');
const { descriptor } = parse(source);
const script = compileScript(descriptor, { id: 'team-regression', inlineTemplate: true });
const compiled = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText;
const picture = fs.readFileSync(new URL('../src/assets/team/alexander-grey.png', import.meta.url));
const contact = fs.readFileSync(new URL('../src/assets/team/cooperation-wechat.png', import.meta.url));
assert.equal(contact.readUInt32BE(16), 888);
assert.equal(contact.readUInt32BE(20), 1131);
assert.deepEqual([...picture.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(picture.readUInt32BE(16), 542);
assert.equal(picture.readUInt32BE(20), 570);
export const teamStyles = descriptor.styles.map(style => style.content).join('\n');
export async function renderTeam() {
  const dependencies = { vue, 'vue-router': { RouterLink: { props: ['to'], setup: (props, { slots }) => () => vue.h('a', { href: props.to }, slots.default?.()) } },
    '../assets/team/alexander-grey.png': 'data:image/png;base64,' + picture.toString('base64'),
    '../assets/team/cooperation-wechat.png': 'data:image/png;base64,' + contact.toString('base64') };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports,
    require(name) { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }
  });
  return renderToString(vue.createSSRApp(module.exports.default));
}
const html = await renderTeam();
assert.match(html, /id="member-name">Alexander Grey<\/h2>/);
assert.match(html, /<strong>牛逼<\/strong>/);
assert.match(html, /href="\/"/);
assert.match(html, /width="542" height="570"/);
assert.match(html, /data:image\/png;base64,/);
assert.match(html, /id="cooperation-title">合作联系<\/h2>/);
assert.match(html, /添加好友请备注来意/);
assert.match(html, /width="888" height="1131"/);
assert.equal((html.match(/<img /g) ?? []).length, 2);
console.log('PASS: 团队姓名/特点、返回首页与原始542×570名片完整展示。');
