<template>
  <section v-if="frames.length" class="loading-barrage" aria-label="趣味演示弹幕，非真实交易" title="配置内容展示，不代表真实交易">
    <div class="barrage-stage" aria-hidden="true">
      <span class="barrage-focus"></span>
      <div v-for="frame in frames" :key="frame.key" class="barrage-flight"
        :class="{ 'barrage-later': frame.key >= 3 }"
        :style="{ '--from-x': `${frame.fromX}%`, '--from-y': `${frame.fromY}%`,
          '--delay': `${frame.delay}ms`, '--cycle': `${frame.cycle}ms` }">
        <div class="barrage-chip" :class="{ 'barrage-foot': frame.type_id === 2 }">
          <span class="barrage-icon">{{ frame.type_id === 1 ? '🪙' : '👣' }}</span>
          <span class="barrage-copy">{{ frame.text }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import config from '../instance/loading-barrage.json';
import { createBarrageFrames, normalizeBarrage } from '../core/loadingBarrage';

const entries = normalizeBarrage(config);
const frames = createBarrageFrames(entries, Math.floor(Math.random() * entries.length));
</script>

<style scoped>
.loading-barrage { width: 100%; margin: 0 auto 12px; }
.barrage-stage { position: relative; height: clamp(260px, 42svh, 420px); overflow: hidden;
  background: radial-gradient(ellipse at center, #efd89120, transparent 58%); }
.barrage-focus { position: absolute; top: 50%; left: 50%; width: 8px; height: 8px; transform: translate(-50%, -50%);
  border-radius: 50%; background: #e4c66288; box-shadow: 0 0 24px 10px #e6c76b22; }
.barrage-flight { position: absolute; inset: 0; pointer-events: none; opacity: 0;
  animation: barrage-converge var(--cycle) cubic-bezier(0.22, 0.55, 0.35, 1) var(--delay) infinite both; }
.barrage-chip { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
  display: flex; align-items: center; gap: 0.5rem; width: max-content; max-width: 78%; padding: 0.65rem 0.9rem;
  box-sizing: border-box; border: 1px solid #eadba7; border-radius: 18px 18px 18px 5px; background: #fff4cd;
  color: #76602b; font-size: clamp(0.8rem, 2.9vw, 1rem); box-shadow: 0 4px 14px #8b71320a; }
.barrage-foot { background: #f6efe5; border-color: #dfd1bb; color: #77664d; border-radius: 18px 18px 5px 18px; }
.barrage-icon { flex-shrink: 0; }
.barrage-copy { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
@keyframes barrage-converge {
  0% { opacity: 0; transform: translate(var(--from-x), var(--from-y)) scale(0.94); }
  9.375%, 26.25% { opacity: 1; transform: translate(var(--from-x), var(--from-y)) scale(1); }
  40.625% { opacity: 0.8; }
  52.5% { opacity: 0.18; }
  62.5%, 100% { opacity: 0; transform: translate(0, 0) scale(0.55); }
}
@media (prefers-reduced-motion: reduce) {
  .barrage-stage { display: flex; flex-direction: column; justify-content: center; gap: 12px; }
  .barrage-flight { position: relative; inset: auto; animation: none; opacity: 1; transform: none; }
  .barrage-chip { position: relative; left: auto; top: auto; transform: none; margin: auto; }
  .barrage-focus { display: none; }
  .barrage-later { display: none; }
}
</style>
