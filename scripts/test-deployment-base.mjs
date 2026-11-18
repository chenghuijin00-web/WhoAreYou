import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const routerSource = fs.readFileSync(new URL('../src/router/index.ts', import.meta.url), 'utf8');
const mainSource = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const registration = mainSource.slice(mainSource.indexOf('for (const path in themeModules)'), mainSource.indexOf('const app ='));
for (const base of ['/', '/PMD/']) {
  const script = ts.transpileModule(routerSource.replaceAll('import.meta.env.BASE_URL', JSON.stringify(base)),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  vm.runInNewContext(script, { module, exports: module.exports,
    require(name) {
      if (name === 'vue-router') return { createRouter: config => config, createWebHistory: base => ({ base }) };
      if (name === '../views/Home.vue') return {};
      throw new Error(`Unexpected import ${name}`);
    } });
  assert.equal(module.exports.default.history.base, base);
  const paths = ['/', '/team', '/test', '/result'];
  if (base === '/') paths.push('/admin/usage');
  assert.deepEqual(Array.from(module.exports.default.routes, route => route.path), paths);
  for (const imageUrl of ['/PMD/images/frog-curious.png', 'https://example.com/photo.png', undefined]) {
    const original = { id: 'test', name: '测试', questions: [], imageUrl };
    let registered;
    vm.runInNewContext(registration.replaceAll('import.meta.env.BASE_URL', JSON.stringify(base)), {
      themeModules: { './test': { config: original } }, themeManager: { registerTheme: config => { registered = config; } }
    });
    assert.equal(registered.imageUrl, imageUrl?.startsWith('/PMD/') ? `${base}images/frog-curious.png` : imageUrl);
    assert.notEqual(registered, original);
    assert.equal(original.imageUrl, imageUrl, '不能变更题库原始配置');
    assert.equal(registered.questions, original.questions);
  }
}
const config = JSON.parse(fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8'));
assert.equal(config.pages_build_output_dir, './dist-cloudflare');
console.log('PASS: Cloudflare根路径与服务器/PMD/路由、内部图片基址、外部图片及源配置保持不变。');
