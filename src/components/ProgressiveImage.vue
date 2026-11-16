<template>
  <span ref="root" class="progressive-image" :class="{ 'is-loaded': loaded, 'is-failed': failed }">
    <span v-if="!loaded" class="image-placeholder" aria-hidden="true"></span>
    <img v-if="requested" :key="`${src}:${retryCount}`" :src="src" :alt="alt" :class="imageClass"
      :width="width" :height="height" :fetchpriority="priority" decoding="async"
      draggable="false" @load="onLoad" @error="onError" />
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = withDefaults(defineProps<{
  src: string; alt?: string; width: number; height: number;
  loading?: 'eager' | 'lazy'; priority?: 'high' | 'low' | 'auto'; imageClass?: string;
}>(), { alt: '', loading: 'lazy', priority: 'auto', imageClass: '' });
const emit = defineEmits<{ load: [event: Event]; error: [event: Event] }>();
const root = ref<HTMLElement | null>(null);
const loaded = ref(false);
const failed = ref(false);
const requested = ref(props.loading === 'eager');
const retryCount = ref(0);
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: IntersectionObserver | undefined;

/** 图片完成后才移除占位；旧节点的迟到事件不得覆盖新图片状态。 */
function onLoad(event: Event) {
  if (event.target !== root.value?.querySelector('img')) return;
  clearTimeout(timer);
  loaded.value = true;
  failed.value = false;
  emit('load', event);
}

/** 临时网络失败只重试两次；不使用破坏缓存的随机参数，也不无限请求。 */
function onError(event: Event) {
  if (event.target !== root.value?.querySelector('img')) return;
  clearTimeout(timer);
  loaded.value = false;
  if (retryCount.value >= 2) {
    failed.value = true;
    emit('error', event);
    return;
  }
  timer = setTimeout(() => { retryCount.value += 1; }, retryCount.value === 0 ? 400 : 1200);
}

watch(() => props.src, () => {
  clearTimeout(timer);
  loaded.value = failed.value = false;
  retryCount.value = 0;
});

onMounted(() => {
  if (requested.value) return;
  if (!('IntersectionObserver' in window)) { requested.value = true; return; }
  // 比原生lazy的预取窗口更小，防止首页下方大批图片与背景争用首屏带宽。
  observer = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    requested.value = true;
    observer?.disconnect();
  }, { rootMargin: '120px' });
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => { clearTimeout(timer); observer?.disconnect(); });
</script>

<style scoped>
.progressive-image { position: relative; display: block; overflow: hidden; }
.progressive-image img { display: block; width: 100%; height: 100%; object-fit: contain; opacity: 0; }
.progressive-image.is-loaded img { opacity: 1; }
.image-placeholder { position: absolute; inset: 0; border-radius: 18%; background: radial-gradient(ellipse, #f8edbd, #fffaf0 75%); }
.is-failed .image-placeholder { opacity: .7; }
</style>
