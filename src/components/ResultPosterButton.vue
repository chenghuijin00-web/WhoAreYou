<template>
  <button type="button" class="poster-trigger" :disabled="generating" @click="openPoster">{{ generating ? '正在生成海报…' : '生成海报' }}</button>
  <Teleport to="body">
    <dialog ref="dialog" class="poster-dialog" aria-label="海报原图预览" @cancel.prevent="closePoster" @click="onBackdropClick">
      <div class="poster-dialog-heading">
        <button type="button" class="poster-close" aria-label="关闭海报预览" @click="closePoster">×</button>
      </div>
      <p v-if="generating" class="poster-status" role="status">正在生成海报…</p>
      <p v-if="error" class="poster-error" role="alert">{{ error }}</p>
      <div class="poster-preview-area">
        <img v-if="previewUrl" class="poster-preview" :src="previewUrl" :alt="`${data.character.name}的奶蛙结果海报，长按可打开系统图片菜单`" />
      </div>
      <div class="poster-dialog-footer">
      <p v-if="previewUrl" class="poster-hint">长按海报保存原图</p>
      <div v-if="error" class="poster-dialog-actions">
        <button v-if="error" type="button" class="poster-save" @click="openPoster">重新生成</button>
      </div>
      </div>
    </dialog>
  </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref } from 'vue';
import { createResultPoster, type ResultPosterData } from '../core/resultPoster';
import { trackUsage } from '../core/usageTracking';

const props = defineProps<{ data: ResultPosterData }>();
const dialog = ref<HTMLDialogElement | null>(null);
const generating = ref(false);
const previewUrl = ref('');
const error = ref('');
let controller: AbortController | undefined;
let generation = 0;
let disposed = false;

function releasePreview() {
  previewUrl.value = '';
}

/** 将原始PNG无损编码为内嵌图片供手机长按保存；只缩放展示，不缩减保存分辨率。 */
function readPreview(blob: Blob, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const cancel = () => { reader.abort(); finish(new DOMException('海报预览已取消', 'AbortError')); };
    function finish(error?: Error) {
      signal.removeEventListener('abort', cancel);
      reader.onload = reader.onerror = reader.onabort = null;
      if (error) reject(error);
      else if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('海报预览读取失败，请重试'));
    }
    reader.onload = () => finish();
    reader.onerror = () => finish(new Error('海报预览读取失败，请重试'));
    reader.onabort = () => finish(new DOMException('海报预览已取消', 'AbortError'));
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    try { reader.readAsDataURL(blob); }
    catch { finish(new Error('海报预览读取失败，请重试')); }
  });
}

/** 关闭或离开页面时取消绘制并释放图片地址，迟到任务不能重新打开弹窗。 */
function closePoster() {
  generation++;
  controller?.abort();
  generating.value = false;
  dialog.value?.close();
  releasePreview();
}

async function openPoster() {
  if (generating.value) return;
  const current = ++generation;
  controller?.abort();
  const taskController = new AbortController();
  controller = taskController;
  generating.value = true;
  error.value = '';
  releasePreview();
  await nextTick();
  if (disposed || current !== generation) return;
  try {
    if (!dialog.value?.open) dialog.value?.showModal();
    const blob = await createResultPoster(props.data, taskController.signal);
    if (disposed || current !== generation) return;
    const preview = await readPreview(blob, taskController.signal);
    if (disposed || current !== generation) return;
    previewUrl.value = preview;
    trackUsage('poster_generated');
  } catch (reason) {
    taskController.abort();
    if (current === generation && !disposed && !(reason instanceof Error && reason.name === 'AbortError')) {
      error.value = reason instanceof Error ? reason.message : '海报生成失败，请重试';
    }
  } finally {
    if (current === generation) generating.value = false;
  }
}

function onBackdropClick(event: MouseEvent) {
  if (event.target !== dialog.value || !dialog.value) return;
  const rect = dialog.value.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closePoster();
}

onBeforeUnmount(() => { disposed = true; closePoster(); });
</script>

<style scoped>
.poster-trigger, .poster-save { display: inline-flex; justify-content: center; align-items: center; padding: 0.9rem 1.5rem; border: 1px solid #dfbf4a; border-radius: 16px; background: #f4d75e; color: #34301c; font: inherit; font-weight: 600; text-decoration: none; cursor: pointer; }
.poster-trigger:disabled { opacity: 0.6; cursor: wait; }
.poster-dialog { box-sizing: border-box; width: min(94vw, 520px); max-height: 94vh; max-height: 94dvh; margin: auto; padding: 0; border: 1px solid #e7d79e; border-radius: 20px; background: #fffcf4; color: #34301c; overflow-y: auto; }
.poster-dialog[open] { display: flex; flex-direction: column; }
.poster-dialog::backdrop { background: #302b1b88; }
.poster-dialog-heading { flex-shrink: 0; display: flex; justify-content: flex-end; align-items: center; padding: 8px 12px; }
.poster-close { border: 0; border-radius: 50%; width: 36px; height: 36px; background: #f5ecd0; color: #584b25; font-size: 1.5rem; cursor: pointer; }
.poster-preview-area { min-height: 0; overflow-y: auto; padding: 0 12px; }
.poster-preview { display: block; width: 100%; height: auto; max-height: max(160px, calc(94dvh - 115px)); object-fit: contain; border-radius: 12px; -webkit-touch-callout: default; user-select: auto; -webkit-user-select: auto; }
.poster-dialog-footer { flex-shrink: 0; padding: 0 16px max(12px, env(safe-area-inset-bottom)); background: #fffcf4; }
.poster-dialog-actions { display: flex; justify-content: center; gap: 10px; }
.poster-status, .poster-error, .poster-hint { margin: 1rem 0; text-align: center; line-height: 1.6; }
.poster-error { color: #a43725; }
.poster-hint { margin: 10px 0; font-size: 0.82rem; color: #65582e; }
@media (max-width: 768px) { .poster-trigger { width: 100%; } }
</style>
