import assert from 'node:assert/strict';
import { createRenderer } from 'vue';
import { getShareEntryUrl, createInviteText, copyTextToClipboard } from '../src/core/resultShare.ts';
import { useResultShare } from '../src/components/useResultShare.ts';

assert.equal(getShareEntryUrl(), 'https://whoareyou-naifrog.pages.dev/');
assert.equal(getShareEntryUrl('https://test.example/app/?result=private#fragment'), 'https://test.example/app/');
for (const bad of ['http://localhost:5182', 'javascript:alert(1)', 'https://user:pass@example.com']) {
  assert.throws(() => getShareEntryUrl(bad));
}
assert.equal(createInviteText(), 'https://whoareyou-naifrog.pages.dev/\n测测你是什么奶族的，我测出来是....');

const renderer = createRenderer({
  createElement: () => ({}), insert() {}, remove() {}, setElementText() {}, patchProp() {},
  createText: () => ({}), createComment: () => ({}), setText() {}, setComment() {},
  parentNode: () => null, nextSibling: () => null
});
let state;
const app = renderer.createApp({ setup() { state = useResultShare(); return () => null; } });
app.mount({});
let opened = 0;
state.shareDialog.value = { open: false, showModal() { opened++; this.open = true; }, close() { this.open = false; } };
Object.defineProperty(globalThis, 'window', { configurable: true, value: { isSecureContext: true, getSelection: () => null } });
function setNavigator(value) { Object.defineProperty(globalThis, 'navigator', { configurable: true, value }); }
let legacyAllowed = false, legacyCalls = 0, removed = 0, selected = 0, restored = 0;
Object.defineProperty(globalThis, 'document', { configurable: true, value: {
  activeElement: { focus() { restored++; } },
  body: { appendChild() {} }, querySelector() { return null; },
  createElement() { return { style: {}, focus() {}, select() { selected++; }, setSelectionRange() {}, remove() { removed++; } }; },
  execCommand(command) { assert.equal(command, 'copy'); legacyCalls++; return legacyAllowed; }
} });
const payload = { title: '奶蛙', text: createInviteText(), url: getShareEntryUrl() };

let finish, calls = 0, nativeCalls = 0;
setNavigator({ share: () => { nativeCalls++; }, clipboard: { writeText: value => {
  calls++; assert.equal(value, payload.text); return new Promise(resolve => { finish = resolve; });
} } });
const pending = state.share(payload);
await state.share(payload);
assert.equal(calls, 1, '复制未结束前不得重复调用');
finish(); await pending;
assert.equal(state.sharing.value, false);
assert.equal(opened, 0);
assert.equal(nativeCalls, 0, '不得调用苹果系统分享');
assert.match(state.shareNotice.value, /已复制/);
setNavigator({});
await state.share(payload);
assert.equal(opened, 1, '所有复制方式失败时提供手动复制入口');
assert.equal(state.shareCopyText.value, payload.text);
let copied;
setNavigator({ clipboard: { writeText: async text => { copied = text; } } });
await state.copyShare();
assert.equal(copied, payload.text);
await state.copyShare(true);
assert.equal(copied, payload.url);
assert.match(state.shareStatus.value, /已复制/);
setNavigator({ clipboard: { writeText: async () => { throw new Error('denied'); } } });
legacyAllowed = true;
assert.equal(await copyTextToClipboard(payload.text), true, '异步API拒绝时尝试兼容复制');
assert.equal(selected, legacyCalls);
assert.equal(removed, legacyCalls, '释放临时文本框');
assert.equal(restored, legacyCalls, '恢复原焦点');
legacyAllowed = false;
await state.copyShare();
assert.match(state.shareStatus.value, /长按/);
window.isSecureContext = false;
await state.copyShare();
assert.match(state.shareStatus.value, /长按/);
app.unmount();
await state.share(payload);
assert.equal(opened, 1, '卸载后不能再打开弹窗');
console.log('PASS: 固定邀请文案、直接复制、不调用系统分享、防连点、异步API/兼容复制、清理恢复、手动兜底及卸载保护');
