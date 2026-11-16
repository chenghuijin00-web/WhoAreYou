import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

// 构建后检查真正的首屏入口，而非只看某一个主文件，避免共享包绕过体积预算。
const cloudflare = process.argv.includes('--cloudflare');
const base = cloudflare ? '/' : '/PMD/';
const output = new URL(cloudflare ? '../dist-cloudflare/' : '../dist/', import.meta.url);
const html = readFileSync(new URL('index.html', output), 'utf8');
const scripts = [...new Set(html.match(/(?:\/PMD)?\/assets\/[^"']+\.js/g) ?? [])];
assert.ok(scripts.length > 0, '构建入口不得为空');
assert.ok(scripts.every(script => script.startsWith(`${base}assets/`)), '入口基址必须匹配构建目标');
let raw = 0, gzip = 0;
for (const script of scripts) {
  const bytes = readFileSync(new URL(script.slice(base.length), output));
  raw += bytes.length;
  gzip += gzipSync(bytes).length;
}
assert.ok(raw < 220 * 1024, `首屏JS超预算：${raw}`);
assert.ok(!/\/(?:Result|Test|echarts)-[^"']+\.js/.test(html), '答题、结果与图表不能预加载到首页');
assert.match(html, new RegExp(`rel="preload" as="image" href="${base}assets/hero-face-base-[^"']+\\.webp"`));
const assets = readdirSync(new URL('assets/', output));
let imageBytes = 0;
for (const prefix of ['hero-face-base-', 'frog-curious-', 'frog-sleepy-', 'frog-phone-']) {
  const files = assets.filter(file => file.startsWith(prefix) && file.endsWith('.webp'));
  assert.equal(files.length, 1, `${prefix}应当有唯一带指纹的WebP`);
  imageBytes += statSync(new URL(`assets/${files[0]}`, output)).size;
}
assert.ok(imageBytes < 120 * 1024, `首页四张图超预算：${imageBytes}`);
console.log(`PASS: 首屏全部JS ${raw}字节(gzip ${gzip})；四张图共${imageBytes}字节；图表/答题/结果按需，背景预加载`);
