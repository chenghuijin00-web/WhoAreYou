<template>
  <div ref="root" class="hero-mascot" :class="{ 'is-immersive': immersive, 'is-pressing': pressing, 'is-rebounding': rebounding, 'is-tongue-pulling': pulling, 'is-tongue-taut': tension > .75 }" :data-motion="active ? 'active' : 'paused'" :data-gaze="gazeMode" :data-tension="tension">
    <div class="mascot-frame mascot-stage" :class="{ 'is-ready': ready }" aria-hidden="true">
      <div class="mascot-head" :style="headStyle">
        <ProgressiveImage class="mascot-face-frame" image-class="mascot-face" :src="mascotAssets.hero" alt=""
          :width="1254" :height="1254" priority="high" loading="eager"
          @load="onImageLoad" @error="onImageError" />
        <span v-for="(eye, index) in eyes" :key="index" class="mascot-eye" aria-hidden="true"
          :class="index === 0 ? 'mascot-eye-left' : 'mascot-eye-right'">
          <span class="mascot-pupil" :style="{ transform: `translate(${eye.x}px, ${eye.y}px)` }"></span>
        </span>
      </div>
    </div>
    <div class="mascot-blend"></div>
    <div v-if="ready" class="mascot-frame mascot-action-stage is-ready">
      <div class="mascot-head" :style="headStyle">
        <div class="mascot-mouth" :class="{ 'is-open': ready }">
          <span ref="tongueLip" class="tongue-lip" aria-hidden="true"><span class="mouth-rim"><span class="mouth-cavity"></span></span></span>
          <div class="tongue-rest">
            <button class="action-button tongue-button" type="button" :disabled="disabled || settling || (immersive && !active)"
              :aria-label="immersive ? '拉动舌头玩耍，松手回弹，不会进入答题' : '点击或向四周拉动舌头，松手回弹后开始奶蛙人格测试'" @click="tongueClick"
              @pointerdown="tongueDown" @pointermove="tongueMove" @pointerup="tongueUp"
              @pointercancel="cancelTongue" @lostpointercapture="tongueLostCapture">
              <span ref="tongueSurface" class="tongue-pull"><span ref="tongueTip" class="tongue-tip" aria-hidden="true"></span><span class="tongue-surface"><span v-show="!immersive" class="tongue-label">点击答题</span></span></span>
            </button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="ready" class="mascot-frame mascot-play-frame is-ready">
      <button class="mascot-play-target" type="button" :disabled="!active" aria-label="轻弹奶蛙，可拖动角色"
        @pointerdown="grab" @pointermove="drag" @pointerup="release" @pointercancel="release"
        @lostpointercapture="release" @click="keyboardBounce"></button>
    </div>
    <button v-if="!ready && !immersive" class="action-button mascot-fallback" type="button" :disabled="disabled"
      @click="emit('start')">点击答题</button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { calculateHeroGaze, calculateTongueGaze, type GazePoint } from '../core/heroGaze';
import ProgressiveImage from './ProgressiveImage.vue';
import { mascotAssets } from '../assets/mascotAssets';
import { useMascotElastic } from './useMascotElastic';
import { useTonguePull } from './useTonguePull';

const props = defineProps<{ disabled?: boolean; immersive?: boolean }>();
const emit = defineEmits<{ start: []; 'ready-change': [ready: boolean] }>();

const root = ref<HTMLElement | null>(null);
const ready = ref(false);
const active = ref(false);
const gazeMode = ref<'idle' | 'target' | 'tongue'>('idle');
const eyes = ref<GazePoint[]>([{ x: 0, y: 0 }, { x: 0, y: 0 }]);
const head = ref({ x: 0, y: 0, tilt: 0 });
const { elasticStyle, pressing, rebounding, grab, drag, release, keyboardBounce, reset } = useMascotElastic(() => active.value, () => !!props.immersive);
const headStyle = computed(() => props.immersive || pressing.value || rebounding.value ? elasticStyle.value : ({ transform: `translate(${head.value.x}px, ${head.value.y}px) rotate(${head.value.tilt}deg)` }));
let media: MediaQueryList | undefined;
let observer: IntersectionObserver | undefined;
let visible = true;
let mounted = false;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let holdTimer: ReturnType<typeof setTimeout> | undefined;
let frame: number | undefined;
let latestPoint: GazePoint | undefined;
const tongueSurface = ref<HTMLElement | null>(null);
const tongueLip = ref<HTMLElement | null>(null);
const tongueTip = ref<HTMLElement | null>(null);
const { settling, pulling, tension, down: tongueDown, move: tongueMove, up: tongueUp, click: tongueClick,
  cancel: cancelTongue, lostCapture: tongueLostCapture } = useTonguePull(tongueSurface, tongueLip,
  () => mounted && ready.value && !props.disabled && (!props.immersive || active.value),
  () => { if (!props.immersive) emit('start'); });
watch(() => [props.disabled, props.immersive], () => cancelTongue());
let tongueGazeFrame: number | undefined;

function stopTongueGaze() {
  if (tongueGazeFrame !== undefined) cancelAnimationFrame(tongueGazeFrame);
  tongueGazeFrame = undefined;
}

/** 只在拉动及回弹期间读取舌尖位置；追踪实际动画而非手指，松手后也不会看偏。 */
function trackTongue() {
  tongueGazeFrame = undefined;
  if (!pulling.value || !active.value || !tongueTip.value) return;
  const rect = tongueTip.value.getBoundingClientRect();
  const tip = { x: rect.left, y: rect.top };
  gazeMode.value = 'tongue';
  eyes.value = eyeElements().map(eye => calculateTongueGaze(tip, eye.getBoundingClientRect(), tension.value));
  tongueGazeFrame = requestAnimationFrame(trackTongue);
}

watch(pulling, value => {
  stopTongueGaze();
  if (value && active.value) {
    stopMotion();
    reset();
    trackTongue();
  } else {
    gazeMode.value = 'idle';
    centerGaze();
    scheduleIdle();
  }
});

/** 停止本组件的全部动画调度，离屏、后台、减少动态及卸载共用同一清理路径。 */
function stopMotion() {
  clearTimeout(idleTimer);
  clearTimeout(holdTimer);
  if (frame !== undefined) cancelAnimationFrame(frame);
  idleTimer = holdTimer = undefined;
  frame = undefined;
  latestPoint = undefined;
}

function centerGaze() {
  eyes.value = [{ x: 0, y: 0 }, { x: 0, y: 0 }];
  head.value = { x: 0, y: 0, tilt: 0 };
}

/** 待机先小幅侧看、停留再回中；复用可取消的两个计时器，不建立持续逐帧循环。 */
function scheduleIdle() {
  clearTimeout(idleTimer);
  if (!active.value || pulling.value) return;
  idleTimer = setTimeout(() => {
    if (!active.value) return;
    gazeMode.value = 'idle';
    const x = (Math.random() < 0.5 ? -1 : 1) * (0.2 + Math.random() * 0.24);
    const y = Math.random() * 0.4 - 0.2;
    eyes.value = eyeElements().map(eye => {
      const rect = eye.getBoundingClientRect();
      return { x: rect.width * 0.14 * x, y: rect.height * 0.12 * y };
    });
    head.value = { x: x * 5, y: y * 5, tilt: x * 1.6 };
    holdTimer = setTimeout(() => { centerGaze(); scheduleIdle(); }, 1400);
  }, 2200 + Math.random() * 1800);
}

function syncActivity() {
  stopMotion();
  reset();
  cancelTongue();
  active.value = mounted && ready.value && visible && !document.hidden && !media?.matches;
  gazeMode.value = 'idle';
  centerGaze();
  scheduleIdle();
}
watch(() => props.immersive, syncActivity);

function eyeElements(): HTMLElement[] {
  return [...(root.value?.querySelectorAll<HTMLElement>('.mascot-eye') || [])];
}

/** 全程使用视口坐标，滚动后也按每只眼睛的实际位置看向同一个点击目标。 */
function lookAt(point: GazePoint) {
  if (!active.value) return;
  gazeMode.value = 'target';
  eyes.value = eyeElements().map(eye => calculateHeroGaze(point, eye.getBoundingClientRect()));
  const rect = root.value?.getBoundingClientRect();
  if (rect) {
    const x = Math.max(-1, Math.min(1, (point.x - rect.left - rect.width / 2) / (rect.width / 2)));
    const y = Math.max(-1, Math.min(1, (point.y - rect.top - rect.height / 2) / (rect.height / 2)));
    head.value = { x: x * 3, y: y * 2, tilt: x * 0.8 };
  }
  holdTimer = setTimeout(() => { gazeMode.value = 'idle'; centerGaze(); scheduleIdle(); }, 1100);
}

function requestLook(point: GazePoint) {
  if (!active.value || props.immersive || pulling.value) return;
  clearTimeout(idleTimer);
  clearTimeout(holdTimer);
  latestPoint = point;
  if (frame !== undefined) return;
  frame = requestAnimationFrame(() => {
    frame = undefined;
    if (latestPoint) lookAt(latestPoint);
  });
}

function onPointerDown(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
  if (event.target instanceof Element && event.target.closest('.tongue-button, .mascot-fallback')) return;
  requestLook({ x: event.clientX, y: event.clientY });
}

function onFocus(event: FocusEvent) {
  if (!(event.target instanceof HTMLElement) || !event.target.matches(':focus-visible')) return;
  if (event.target.closest('.tongue-button, .mascot-fallback')) return;
  const rect = event.target.getBoundingClientRect();
  requestLook({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
}

function updateReadiness(value: boolean) {
  ready.value = value;
  if (mounted) syncActivity();
  emit('ready-change', value);
}
function onImageLoad() { updateReadiness(true); }
function onImageError() { updateReadiness(false); }

onMounted(() => {
  mounted = true;
  media = window.matchMedia('(prefers-reduced-motion: reduce)');
  media.addEventListener('change', syncActivity);
  document.addEventListener('visibilitychange', syncActivity);
  window.addEventListener('blur', reset);
  window.addEventListener('blur', cancelTongue);
  // 捕获阶段观察点击，不阻止按钮自己的事件，也不要求装饰背景参与命中。
  document.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
  document.addEventListener('focusin', onFocus);
  observer = new IntersectionObserver(entries => {
    visible = !!entries[0]?.isIntersecting && entries[0].intersectionRatio >= 0.05;
    syncActivity();
  }, { threshold: 0.05 });
  if (root.value) observer.observe(root.value);
  window.addEventListener('resize', syncActivity, { passive: true });
  syncActivity();
});

onBeforeUnmount(() => {
  mounted = false;
  active.value = false;
  stopTongueGaze();
  stopMotion();
  observer?.disconnect();
  media?.removeEventListener('change', syncActivity);
  document.removeEventListener('visibilitychange', syncActivity);
  window.removeEventListener('blur', reset);
  window.removeEventListener('blur', cancelTongue);
  document.removeEventListener('pointerdown', onPointerDown, true);
  document.removeEventListener('focusin', onFocus);
  window.removeEventListener('resize', syncActivity);
});
</script>

<style scoped>
.hero-mascot { position: absolute; inset: 0; z-index: 0; overflow: hidden; pointer-events: none; border-radius: inherit; }
.mascot-frame { position: absolute; width: 850px; aspect-ratio: 1; top: -180px; right: -60px; visibility: hidden; }
.mascot-frame.is-ready { visibility: visible; }
.mascot-action-stage { z-index: 2; }
.mascot-head { position: relative; width: 100%; height: 100%; transition: transform .65s ease-out; }
.hero-mascot:is(.is-immersive, .is-pressing, .is-rebounding) .mascot-head { transform-origin: 50% 100%; transition: none; }
.hero-mascot.is-rebounding .mascot-head { animation: jelly-rebound var(--jelly-duration) ease-in-out both; }
.tongue-rest { transform-origin: 50% 12%; }
.hero-mascot.is-pressing .tongue-rest { transform: rotate(calc(var(--jelly-shear) * 16deg)) scaleY(calc(1 - var(--jelly-stretch) * .24)); }
.hero-mascot.is-rebounding .tongue-rest { animation: jelly-tongue var(--jelly-duration) ease-in-out both; }
.tongue-button { touch-action: none; }
.tongue-pull, .tongue-lip { position: absolute; inset: 0; border-radius: inherit; transform-origin: 50% 0; pointer-events: none; }
.is-tongue-pulling :is(.mouth-rim, .tongue-surface) { animation-play-state: paused !important; }
.tongue-tip { position: absolute; left: 50%; top: 92%; width: 0; height: 0; pointer-events: none; }
.is-tongue-pulling.is-tongue-taut .tongue-surface { animation: tongue-quiver .16s ease-in-out infinite; animation-play-state: running !important; }
@keyframes tongue-quiver {
  0%, 100% { transform: translateX(-.8px) rotate(-.35deg); }
  50% { transform: translateX(.8px) rotate(.35deg); }
}
/* 两个头部图层共享同一套矩阵关键帧；底边不位移，嘴和眼睛不会从脸上脱开。 */
@keyframes jelly-rebound {
  0% { transform: matrix(1, 0, var(--jelly-shear), calc(1 + var(--jelly-stretch)), 0, 0); }
  26% { transform: matrix(1, 0, calc(var(--jelly-shear) * -.50), calc(1 - var(--jelly-stretch) * .50), 0, 0); }
  50% { transform: matrix(1, 0, calc(var(--jelly-shear) * .24), calc(1 + var(--jelly-stretch) * .24), 0, 0); }
  72% { transform: matrix(1, 0, calc(var(--jelly-shear) * -.10), calc(1 - var(--jelly-stretch) * .10), 0, 0); }
  100% { transform: matrix(1, 0, 0, 1, 0, 0); }
}
/* 舌根仍贴着嘴，舌尖晚于脸部反向摆动，避免像硬贴图一样同时停下。 */
@keyframes jelly-tongue {
  0% { transform: rotate(calc(var(--jelly-shear) * 16deg)) scaleY(calc(1 - var(--jelly-stretch) * .24)); }
  14% { transform: rotate(calc(var(--jelly-shear) * 21deg)) scaleY(calc(1 - var(--jelly-stretch) * .30)); }
  40% { transform: rotate(calc(var(--jelly-shear) * -15deg)) scaleY(calc(1 + var(--jelly-stretch) * .22)); }
  65% { transform: rotate(calc(var(--jelly-shear) * 8deg)) scaleY(calc(1 - var(--jelly-stretch) * .12)); }
  86% { transform: rotate(calc(var(--jelly-shear) * -3deg)) scaleY(calc(1 + var(--jelly-stretch) * .05)); }
  100% { transform: none; }
}
/* 普通模式：透明拖拽区在舌头下方；纯享模式：舌头也属于可玩区域。 */
.mascot-play-frame { z-index: 1; pointer-events: none; }
.is-immersive .mascot-play-frame { z-index: 3; }
.is-immersive .mascot-action-stage { z-index: 4; }
.mascot-play-target { position: absolute; inset: 6% 8% 6%; border: 0; border-radius: 48% 48% 20% 20%; background: transparent; pointer-events: auto; touch-action: none; user-select: none; cursor: grab; }
/* 不让触屏点按高亮显出透明命中区；保留键盘的 focus-visible。 */
.mascot-play-target { -webkit-tap-highlight-color: transparent; }
.is-pressing .mascot-play-target { cursor: grabbing; }
.mascot-play-target:focus-visible { outline: 2px dashed #826123; outline-offset: -3px; }
.mascot-play-target:disabled { pointer-events: none; }
#app .hero .is-immersive .tongue-button:not(:disabled) { cursor: grab; }
#app .hero .is-immersive.is-tongue-pulling .tongue-button:not(:disabled) { cursor: grabbing; }
.mascot-face-frame { display: block; width: 100%; height: 100%; mask-image: linear-gradient(#000 0%, #000 62%, transparent 96%); }
.mascot-eye { position: absolute; top: 45%; width: 22%; height: 30%; display: flex; align-items: center; justify-content: center; transform: translate(-50%, -50%); }
.mascot-eye-left { left: 22.7%; }
.mascot-eye-right { left: 75.8%; }
.mascot-pupil { position: relative; width: 61%; height: 59%; border-radius: 50%; background: radial-gradient(ellipse at 36% 25%, #263024, #0d160c 65%, #081007); box-shadow: inset 0 2px 5px #3c4c2a55; transition: transform .2s cubic-bezier(.2,.7,.3,1); }
.mascot-pupil::after { content: ''; position: absolute; top: 20%; left: 23%; width: 16%; aspect-ratio: 1; border-radius: 50%; background: #ffffffe0; box-shadow: 0 0 3px #fff8; }
.hero-mascot[data-gaze='idle'] .mascot-pupil { transition-duration: .8s; transition-timing-function: ease-in-out; }
.hero-mascot[data-gaze='tongue'] .mascot-pupil { transition-duration: .07s; transition-timing-function: ease-out; }
/* 嘴部与底图共用坐标、随头部一起运动；按钮仅自身接收点击，不挡住标题。 */
.mascot-mouth { position: absolute; z-index: 2; left: 29%; top: 70%; width: 41%; height: 23%; }
.mouth-rim { position: absolute; inset: 0; transform-origin: 50% 9%; animation: lip-rest 4.8s ease-in-out .9s infinite both; animation-play-state: paused; }
.mouth-cavity::after { content: ''; position: absolute; top: 75%; left: 4%; width: 92%; height: 25%; border-radius: 0 0 50% 50%; border-bottom: 3px solid #bc7e394d; box-shadow: 0 3px 5px #985d2415; }
.tongue-rest { position: absolute; inset: 0; }
.tongue-surface { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; box-sizing: border-box; padding-top: 16%; border-radius: inherit; background: radial-gradient(ellipse at 45% 80%, #e77990 0%, #d95b7b 48%, #b84062 90%); box-shadow: inset 0 8px 10px #ad355150, inset 5px 0 7px #ffc5c966, 0 9px 12px #7b352922; pointer-events: none; transform-origin: 50% 0; animation: tongue-rest 4.8s ease-in-out .9s infinite both; animation-play-state: paused; }
.hero-mascot[data-motion='active'] :is(.mouth-rim, .tongue-surface) { animation-play-state: running; }
.mouth-cavity { position: absolute; inset: 0 0 auto; height: 39%; border-radius: 12% 12% 50% 50% / 18% 18% 85% 85%; background: radial-gradient(ellipse at 50% 110%, #70352e, #321b16 78%); box-shadow: inset 0 6px 8px #160c0b88, 0 -3px 5px #9a632454; transform: scaleY(.06); transform-origin: top; }
#app .hero .tongue-button { position: absolute; top: 12%; left: 13%; width: 74%; height: 84%; min-height: 52px; display: flex; justify-content: center; align-items: center; padding: 12% 0 0; margin: 0; border: 0; border-radius: 34% 31% 49% 46% / 22% 20% 55% 52%; color: #581c2b; background: transparent; box-shadow: none; font-size: clamp(16px, 1.65vw, 22px); font-weight: 650; letter-spacing: .04em; cursor: pointer; pointer-events: auto; transform: scaleY(.02); transform-origin: 50% 0; opacity: 0; }
.tongue-surface::before { content: ''; position: absolute; top: 3%; left: 49%; width: 1.5%; height: 26%; border-radius: 50%; background: linear-gradient(#b6476655, transparent); }
.tongue-surface::after { content: ''; position: absolute; inset: 8% 12% 46%; border-radius: 50%; background: radial-gradient(ellipse, #ffd1d52b, transparent 70%); pointer-events: none; }
.tongue-label { position: relative; z-index: 1; }
.tongue-label { opacity: 0; }
.is-open .mouth-cavity { animation: mouth-open 900ms cubic-bezier(.25,.65,.3,1) both; }
#app .hero .is-open .tongue-button { animation: tongue-out 900ms cubic-bezier(.25,.65,.3,1) both; }
.is-open .tongue-label { animation: tongue-text 900ms ease-out both; }
#app .hero .tongue-button:focus-visible { outline: 3px solid #744322; outline-offset: 6px; }
/* 不沿用普通黄色按钮的悬停换色、阴影和位移，舌头保持同一种材质。 */
#app .hero .tongue-button:hover:not(:disabled) { filter: none; color: #581c2b; background: transparent; box-shadow: none; }
#app .hero .tongue-button:disabled { cursor: wait; }
@keyframes mouth-open {
  0% { transform: scaleY(.06); }
  18% { transform: scale(.99,.88); }
  46% { transform: scale(.98,1.1); }
  67% { transform: scale(1.01,.96); }
  84% { transform: scale(.998,1.02); }
  100% { transform: scale(1,1); }
}
/* 舌根固定在嘴内：伸长时略收窄，回缩时略变宽，最后收敛，避免整块机械放大。 */
@keyframes tongue-out {
  0%,8% { opacity: 0; transform: scale(.72,.025); }
  18% { opacity: 1; transform: scale(.8,.24); }
  46% { opacity: 1; transform: scale(.9,1.22); }
  67% { opacity: 1; transform: scale(1.04,.94); }
  84% { opacity: 1; transform: scale(.985,1.035); }
  100% { opacity: 1; transform: scale(1,1); }
}
@keyframes tongue-text { 0%,78% { opacity: 0; } 100% { opacity: 1; } }
/* 外层待机与内层900ms开场分开，避免两个动画抢同一个transform；嘴沿共享节奏轻收放。 */
@keyframes tongue-rest {
  0%,100% { transform: translateY(0) rotate(0deg) scale(1,1); }
  32% { transform: translateY(1px) rotate(.55deg) scale(.994,1.025); }
  62% { transform: translateY(-.5px) rotate(-.4deg) scale(1.008,.985); }
  82% { transform: translateY(.5px) rotate(.2deg) scale(.998,1.01); }
}
@keyframes lip-rest {
  0%,100% { transform: scale(1,1); }
  32% { transform: scale(.995,1.04); }
  62% { transform: scale(1.006,.98); }
  82% { transform: scale(.998,1.015); }
}
.mascot-blend { position: absolute; inset: 0; background: linear-gradient(90deg, #fffdf6 0%, #fffdf6f2 22%, #fffdf6a3 40%, transparent 65%), linear-gradient(0deg, #fff 0%, #ffffffeb 5%, transparent 37%); }
#app .hero .mascot-fallback { position: absolute; top: 67%; right: 14%; pointer-events: auto; }
@media (min-width: 769px) and (max-width: 1100px) { .mascot-frame { width: 760px; top: -140px; right: -155px; } }
@media (max-width: 768px) {
  .mascot-frame { width: clamp(390px, 115vw, 600px); top: 125px; right: 50%; transform: translateX(50%); }
  .mascot-blend { background: linear-gradient(180deg, #fffdf6 0%, #fffdf6fa 14%, #fffdf6b3 24%, transparent 34%, transparent 68%, #fff 100%); }
  #app .hero .tongue-button { font-size: clamp(16px, 3.8vw, 20px); }
  #app .hero .mascot-fallback { top: auto; bottom: 45px; right: 50%; transform: translateX(50%); }
}
@media (min-width: 600px) and (max-width: 768px) { .mascot-frame { top: 170px; } }
@media (prefers-reduced-motion: reduce) {
  .mascot-head, .mascot-pupil { transition: none; }
  .hero-mascot.is-rebounding :is(.mascot-head, .tongue-rest) { animation: none; }
  .hero-mascot[data-gaze='idle'] .mascot-pupil { transition: none; }
  .hero-mascot[data-gaze='tongue'] .mascot-pupil { transition: none; }
  .mouth-rim, .tongue-surface { animation: none; transform: none; }
  .is-open .mouth-cavity, #app .hero .is-open .tongue-button, .is-open .tongue-label { animation: none; transform: none; opacity: 1; }
}
</style>
