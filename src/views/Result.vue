<template>
  <div class="result" :class="{ 'result-compact': result?.preferences }">
    <div v-if="result" class="result-container">
      <section class="result-overview" aria-label="你的奶蛙结果概览">
      <!-- Header -->
      <div class="result-header">
        <button class="back-home-btn" @click="restartTest" aria-label="重新测试">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
          </svg>
          <span>重新测试</span>
        </button>
        
        <p class="result-brand">纯种奶蛙鉴赏</p>
        <RouterLink class="cooperation-link" to="/team" aria-label="合作，查看团队介绍">合作</RouterLink>
      </div>

      <!-- Personality Card -->
      <div class="personality-card-section">
        <div class="personality-glass-card">
          <div class="p-left-col">
            <ProgressiveImage :key="result.personality_type" class="frog-result-mascot" :src="resultMascot" :alt="getPersonalityName(result.personality_type)" :width="256" :height="256" loading="eager" />
            <div v-if="!result.type_code" class="percentage-circle">
              <svg class="ring-svg" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
                    <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:1" />
                  </linearGradient>
                </defs>
                <circle 
                  class="ring-bg" 
                  cx="60" 
                  cy="60" 
                  r="54"
                  fill="none"
                  stroke="#f1f5f9"
                  stroke-width="7"
                />
                <circle 
                  class="ring-progress" 
                  cx="60" 
                  cy="60" 
                  r="54"
                  fill="none"
                  stroke="url(#ringGrad)"
                  stroke-width="7"
                  :stroke-dasharray="circumference"
                  :stroke-dashoffset="strokeDashoffset"
                  stroke-linecap="round"
                />
              </svg>
              
              <div class="percentage-inner">
                <span class="percent-num">{{ result.match_percentage }}</span>
                <span class="percent-sign">%</span>
              </div>
            </div>
            
            <div v-if="!result.type_code" class="purity-label-text">模板匹配度</div>
          </div>

          <div class="p-right-col">
            <div class="personality-heading">
              <p v-if="isEntertainment && !hasUnclearAxes" class="personality-identity">你的身份是：</p>
              <h2 class="personality-name">{{ hasUnclearAxes ? '这次先不急着定义你' : getPersonalityName(result.personality_type) }}</h2>
            </div>
            <div class="meme-row">
              <button v-if="canRefreshMeme" class="meme-refresh-btn" @click="testStore.refreshMeme()" aria-label="换一句短评" title="换一句短评">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                  <path d="M20 7v5h-5M4 17v-5h5"/><path d="M6 7a7 7 0 0 1 12-1l2 2M4 16l2 2a7 7 0 0 0 12-1"/>
                </svg>
              </button>
              <p class="personality-meme" aria-live="polite" aria-atomic="true">{{ hasUnclearAxes ? '部分偏好接近，两边的你都可以存在。' : displayedMeme }}</p>
            </div>
            <div v-if="!hasUnclearAxes && personalityTags.length" class="frog-tags">
              <span v-for="tag in personalityTags" :key="tag">{{ tag }}</span>
            </div>
          </div>
        </div>
      </div>

      <section v-if="relations" class="frog-relations" aria-label="奶蛙角色关系">
        <div class="frog-relations-grid">
          <article v-for="relation in relationCards" :key="relation.label" class="frog-relation-card">
            <h3 class="frog-relation-title">{{ relation.label }}</h3>
            <div class="frog-relation-figures">
              <figure v-for="persona in relation.personas" :key="persona.id" class="frog-relation-person">
                <ProgressiveImage class="frog-relation-mascot" :src="getPersonaImage(persona.id) || mascotAssets.curious" :alt="persona.name" :width="96" :height="96" />
                <figcaption class="frog-relation-name">{{ persona.name }}</figcaption>
              </figure>
            </div>
          </article>
        </div>
        <p class="frog-relations-note">奶蛙世界整活搭配，与现实朋友关系无关。</p>
      </section>

      <div class="result-overview-actions">
        <ResultPosterButton v-if="posterData" :key="`${result.personality_type}:${displayedMeme}`" :data="posterData" />
        <a v-if="personaReview" href="#frog-persona-review-title" class="result-review-link">完整评语 ↓</a>
        <button class="invite-share-btn" :disabled="sharing" @click="shareResult">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>
          </svg>
          <span>测测其他人</span>
        </button>
      </div>
      </section>

      <!-- 仅旧主题保留雷达图；奶蛙结果不展示计分分析。 -->
      <div v-if="!result.preferences" class="chart-section-block">
        <h3 class="section-title-heading">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/>
            <line x1="12" y1="22" x2="12" y2="15.5"/>
            <polyline points="22 8.5 12 15.5 2 8.5"/>
          </svg>
          维度分析
        </h3>
        <div ref="radarChartRef" class="chart-wrapper"></div>
      </div>

      <!-- 保留当前奶蛙角色的完整评语。 -->
      <section v-if="personaReview" class="interpretation-block frog-persona-review" aria-labelledby="frog-persona-review-title">
        <h3 id="frog-persona-review-title" class="section-title-heading">你的奶蛙评语</h3>
        <div class="interpretation-box">
          <p class="interpretation-text-content">{{ personaReview }}</p>
        </div>
      </section>


      <!-- Action Buttons -->
      <div class="action-buttons-row">
        <button class="action-btn-primary" @click="restartTest">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="23 4 23 10 17 10"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
          <span>重新蒸馏</span>
        </button>
        
        <button class="action-btn-secondary" :disabled="sharing" @click="shareResult">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          <span>分享结果</span>
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-else class="loading-view">
      <div class="spinner-ring"></div>
      <p>生成结果中...</p>
    </div>
    <Teleport to="body">
      <p v-if="shareNotice" class="result-share-toast" role="status">{{ shareNotice }}</p>
      <dialog ref="shareDialog" class="result-share-dialog" aria-labelledby="result-share-title" @cancel.prevent="closeShare">
        <div class="result-share-heading">
          <h2 id="result-share-title">喊朋友来认领奶蛙身份</h2>
          <button type="button" aria-label="关闭分享" @click="closeShare">×</button>
        </div>
        <p class="result-share-hint">把测试入口发给朋友，让他们测出自己的蛙。微信内可复制发送，或关闭后生成海报，长按保存分享。</p>
        <div class="result-share-actions">
          <button type="button" :disabled="copying" @click="copyShare(false)">复制文案和链接</button>
          <button type="button" :disabled="copying" @click="copyShare(true)">只复制测试链接</button>
        </div>
        <p class="result-share-status" role="status" aria-live="polite">{{ shareStatus }}</p>
        <label for="result-share-copy">也可长按下方文字手动复制</label>
        <textarea id="result-share-copy" :value="shareCopyText" readonly rows="5" @focus="($event.target as HTMLTextAreaElement).select()"></textarea>
      </dialog>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { mascotAssets } from '../assets/mascotAssets';
import { getPersonaImage } from '../assets/personaAssets';
import { createInviteText, getShareEntryUrl } from '../core/resultShare';
import { useResultShare } from '../components/useResultShare';
import ProgressiveImage from '../components/ProgressiveImage.vue';
import ResultPosterButton from '../components/ResultPosterButton.vue';
import { getFrogRelations, FROG_RELATION_LABELS } from '../core/frogRelations';
import type { ResultPosterData } from '../core/resultPoster';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { useTestStore } from '../stores/testStore';
import * as echarts from 'echarts';

const router = useRouter();
const testStore = useTestStore();
const { shareDialog, sharing, copying, shareStatus, shareNotice, shareCopyText, share, copyShare, closeShare } = useResultShare();
const radarChartRef = ref<HTMLElement | null>(null);
let radarChart: echarts.ECharts | null = null;

const result = computed(() => testStore.result);
const isEntertainment = computed(() => testStore.currentTheme?.typeResolution === 'entertainment');
const hasUnclearAxes = computed(() => result.value?.display_code?.includes('X') || false);
const matchedPersona = computed(() => testStore.currentTheme?.personalityTypes.find(type => type.id === result.value?.personality_type));
const displayedMeme = computed(() => result.value?.display_meme || matchedPersona.value?.meme || '');
const canRefreshMeme = computed(() => !hasUnclearAxes.value && isEntertainment.value && (matchedPersona.value?.memeVariants?.length ?? 0) > 1);
const personalityTags = computed(() => matchedPersona.value?.tags || []);
const personaReview = computed(() => isEntertainment.value && result.value?.preferences && !hasUnclearAxes.value ? matchedPersona.value?.description : undefined);
const resultMascot = computed(() => {
  return getPersonaImage(result.value?.personality_type ?? '') ?? mascotAssets.curious;
});
const relations = computed(() => hasUnclearAxes.value ? null
  : getFrogRelations(result.value?.personality_type ?? '', testStore.currentTheme?.personalityTypes ?? []));
const relationCards = computed(() => relations.value ? [
  { label: FROG_RELATION_LABELS.fakeFriend, personas: relations.value.fakeFriends },
  { label: FROG_RELATION_LABELS.confidant, personas: relations.value.confidants }
] : []);
const posterData = computed<ResultPosterData | null>(() => {
  const persona = matchedPersona.value;
  const related = relations.value;
  if (!persona || !related) return null;
  const character = (type: typeof persona) => ({ name: type.name, imageUrl: getPersonaImage(type.id) ?? mascotAssets.curious });
  return {
    character: { ...character(persona), meme: displayedMeme.value, tags: persona.tags ?? [] },
    fakeFriend: character(related.fakeFriend), confidant: character(related.confidant),
    fakeFriends: related.fakeFriends.map(character), confidants: related.confidants.map(character),
    entryUrl: getShareEntryUrl()
  };
});

const circumference = 2 * Math.PI * 54;
const strokeDashoffset = computed(() => {
  const percentage = result.value?.match_percentage || 0;
  return circumference - (percentage / 100) * circumference;
});

const getPersonalityName = (personalityId: string) => {
  const theme = testStore.currentTheme;
  if (!theme) return '未知人格';
  const personality = theme.personalityTypes.find(p => p.id === personalityId);
  return personality ? personality.name : '未知人格';
};

const restartTest = () => {
  testStore.resetTest();
  router.push('/');
};

/** 三处分享按钮与海报统一正式入口，邀请朋友重新答题而不是打开当前人的结果。 */
const shareResult = () => {
  const text = createInviteText();
  return share({ title: '纯种奶蛙鉴赏 | 你是什么东西', text, url: getShareEntryUrl() });
};

// Simple, reliable radar chart initialization
const initRadarChart = () => {
  // Wait a bit for the DOM to be ready
  setTimeout(() => {
    if (!radarChartRef.value) return;
    if (!result.value) return;

    // Dispose old instance
    if (radarChart) {
      radarChart.dispose();
      radarChart = null;
    }

    const theme = testStore.currentTheme;
    if (!theme) return;

    // Initialize chart
    radarChart = echarts.init(radarChartRef.value);

    const dimensions = theme.dimensions;
    const indicator = dimensions.map(dim => ({
      name: dim.name,
      max: 3
    }));

    const seriesData = dimensions.map(dim => {
      return result.value?.dimensions[dim.id] || 1;
    });

    const option = {
      tooltip: {
        formatter: (params: any) => {
          const val = params.value;
          if (!val || !Array.isArray(val)) return '';
          return indicator.map((ind: any, i: number) => 
            `${ind.name}: ${Number(val[i]).toFixed(1)}`
          ).join('<br/>');
        }
      },
      radar: {
        indicator: indicator,
        shape: 'polygon',
        splitNumber: 3,
        axisName: {
          color: '#64748b',
          fontSize: 11,
          fontWeight: 500
        },
        splitLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        },
        splitArea: {
          show: true,
          areaStyle: {
            color: [
              'rgba(229, 196, 72, 0.05)',
              'rgba(229, 196, 72, 0.09)',
              'rgba(229, 196, 72, 0.14)'
            ]
          }
        },
        axisLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        }
      },
      series: [{
        type: 'radar',
        data: [{
          value: seriesData,
          name: '你的得分',
          areaStyle: {
            color: 'rgba(229, 196, 72, 0.30)'
          },
          lineStyle: {
            width: 2.5,
            color: '#a17e16'
          },
          itemStyle: {
            color: '#a17e16',
            borderColor: '#fff',
            borderWidth: 2
          }
        }]
      }]
    };

    radarChart.setOption(option);
    
    // Resize after render
    setTimeout(() => {
      radarChart?.resize();
    }, 200);
  }, 300);
};

const resizeChart = () => radarChart?.resize();
onMounted(() => {
  if (!testStore.isTestCompleted) {
    router.push('/');
  } else if (!result.value?.preferences) {
    initRadarChart();
  }

  window.addEventListener('resize', resizeChart);
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart);
  radarChart?.dispose();
});
</script>

<style scoped>
.result-share-toast { position: fixed; z-index: 10000; bottom: max(30px, env(safe-area-inset-bottom)); left: 50%; transform: translateX(-50%); width: max-content; max-width: 86vw; box-sizing: border-box; margin: 0; padding: 12px 20px; border-radius: 16px; background: #49402b; color: #fff9e6; font-size: 15px; line-height: 1.6; text-align: center; box-shadow: 0 4px 20px #302b1b33; pointer-events: none; }
.result-share-dialog { box-sizing: border-box; width: min(92vw, 480px); max-height: 88dvh; margin: auto; padding: 22px; border: 1px solid #e6d79e; border-radius: 24px; background: #fffcf3; color: #65582e; overflow-y: auto; }
.result-share-dialog::backdrop { background: #302b1b88; }
.result-share-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.result-share-heading h2 { margin: 0; font-size: 19px; line-height: 1.5; }
.result-share-heading button { flex-shrink: 0; width: 38px; height: 38px; border: 0; border-radius: 50%; background: #f4ecd1; color: #65582e; font-size: 24px; cursor: pointer; }
.result-share-hint { margin: 16px 0; font-size: 14px; line-height: 1.8; }
.result-share-actions { display: grid; gap: 10px; }
.result-share-actions button { min-height: 46px; padding: 10px; border: 1px solid #e0c974; border-radius: 14px; background: #f2dc77; color: #4b3f1e; font: inherit; cursor: pointer; }
.result-share-actions button:last-child { background: #fff7d5; }
.result-share-actions button:disabled { opacity: .6; cursor: wait; }
.result-share-status { min-height: 24px; margin: 12px 0; font-size: 14px; line-height: 1.6; }
.result-share-dialog label { font-size: 13px; }
.result-share-dialog textarea { box-sizing: border-box; display: block; width: 100%; margin-top: 8px; padding: 12px; border: 1px solid #e6d79e; border-radius: 12px; background: white; color: #65582e; font: inherit; font-size: 16px; line-height: 1.7; resize: vertical; user-select: text; -webkit-user-select: text; }
/* ===== Global Styles ===== */
.result {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  color: #1e293b;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 2rem;
}

.result-container {
  max-width: 1050px;
  margin: 0 auto;
}

/* ===== Header ===== */
.result-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2.8rem;
}

.back-home-btn,
.share-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.15rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.88rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.back-home-btn:hover,
.share-btn:hover {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0ea5e9;
}

.result-title {
  font-size: 1.55rem;
  font-weight: 700;
  color: #1e293b;
  letter-spacing: -0.02em;
}

/* ===== Personality Card ===== */
.personality-card-section {
  margin-bottom: 2.8rem;
}

.personality-glass-card {
  background: white;
  border-radius: 26px;
  padding: 2.8rem;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.03);
  border: 1px solid #f1f5f9;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2.8rem;
  align-items: center;
}

.p-left-col {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.3rem;
}

.frog-relations { margin: 0 0 2.2rem; }
.frog-relations-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
.frog-relation-card { min-width: 0; padding: 1.1rem 0.75rem; text-align: center; border: 1px solid #e9dbaa; border-radius: 22px; background: #fffcf1; }
.frog-relation-title { min-height: 3.2em; margin: 0 0 0.5rem; color: #796638; font-size: 0.88rem; font-weight: 500; line-height: 1.6; overflow-wrap: anywhere; }
.frog-relation-figures { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.7rem; }
.frog-relation-person { min-width: 0; margin: 0; }
.frog-relation-mascot { width: min(96px, 100%); height: 96px; margin: 0.4rem auto; }
.frog-relation-name { margin: 0; color: #343321; font-size: 0.92rem; font-weight: 700; overflow-wrap: anywhere; }
.frog-relations-note { margin: 0.8rem 0 0; color: #847044; font-size: 0.76rem; text-align: center; }
@media (max-width: 768px) {
  .frog-relations-grid { grid-template-columns: 1fr; gap: 0.85rem; }
  .frog-relation-title { min-height: 0; }
  .frog-relation-mascot { height: 88px; }
}

.result .frog-result-mascot {
  width: clamp(180px, 22vw, 256px);
  height: clamp(180px, 22vw, 256px);
  flex-shrink: 0;
}

.percentage-circle {
  position: relative;
  width: 155px;
  height: 155px;
}

.ring-svg {
  transform: rotate(-90deg);
  width: 100%;
  height: 100%;
}

.ring-bg {
  fill: none;
  stroke: #f1f5f9;
  stroke-width: 7;
}

.ring-progress {
  fill: none;
  transition: stroke-dashoffset 2s cubic-bezier(0.23, 1, 0.32, 1);
}

.percentage-inner {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
}

.percent-num {
  font-size: 2.85rem;
  font-weight: 800;
  background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.percent-sign {
  font-size: 1.15rem;
  color: #94a3b8;
  margin-left: 2px;
}

.purity-label-text {
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.p-right-col {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.personality-name {
  font-size: 2.1rem;
  font-weight: 800;
  color: #1e293b;
  line-height: 1.2;
  background: linear-gradient(135deg, #0ea5e9 0%, #8b5cf6 50%, #ec4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.meme-row { display: flex; align-items: center; gap: 8px; width: 100%; max-width: 620px; }
.meme-row .personality-meme { flex: 1; min-width: 0; }
.meme-refresh-btn { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 28px; width: 28px; height: 32px;
  padding: 0; border: 1px solid #e7d79e; border-radius: 50%; background: #fff9df; color: #8b753c; cursor: pointer; }
.meme-refresh-btn:hover { background: #f7e9b1; }
.meme-refresh-btn:active svg { transform: rotate(90deg); }
.meme-refresh-btn:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; }
.personality-meme {
  font-size: 1.1rem;
  color: #64748b;
  font-style: italic;
  line-height: 1.5;
}

/* ===== Chart & Interpretation Sections ===== */
.chart-section-block,
.interpretation-block {
  margin-bottom: 2.2rem;
}

.section-title-heading {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1.3rem;
}

.section-title-heading svg {
  color: #0ea5e9;
}

.chart-wrapper {
  background: white;
  border-radius: 20px;
  padding: 1.5rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
  height: 400px;
  width: 100%;
}

.interpretation-box {
  background: white;
  border-radius: 20px;
  padding: 2rem;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.05);
  border: 1px solid #f1f5f9;
  border-left: 3px solid #0ea5e9;
}

.interpretation-text-content {
  white-space: pre-line;
  color: #475569;
  line-height: 1.82;
  font-size: 1.02rem;
  margin: 0;
}

/* ===== Action Buttons ===== */
.action-buttons-row {
  display: flex;
  justify-content: center;
  gap: 1.3rem;
  margin-top: 2.8rem;
  flex-wrap: wrap;
}

.action-btn-primary {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 1.05rem 2.1rem;
  background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
  border: none;
  border-radius: 13px;
  color: white;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  box-shadow: 0 7px 26px rgba(14, 165, 233, 0.32);
}

.action-btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: 0 11px 38px rgba(14, 165, 233, 0.42);
}

.action-btn-secondary {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 1.05rem 2.1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 13px;
  color: #334155;
  font-size: 0.98rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s ease;
}

.action-btn-secondary:hover {
  background: #f0f9ff;
  border-color: #bae6fd;
  color: #0ea5e9;
  transform: translateY(-3px);
}

/* ===== Loading ===== */
.loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 58vh;
  gap: 1.8rem;
}

.spinner-ring {
  width: 54px;
  height: 54px;
  border: 3px solid #e2e8f0;
  border-top-color: #0ea5e9;
  border-radius: 50%;
  animation: spin-animation 1s linear infinite;
  box-shadow: 0 0 18px rgba(14, 165, 233, 0.28);
}

@keyframes spin-animation {
  to { transform: rotate(360deg); }
}

.loading-view p {
  color: #94a3b8;
  font-size: 0.98rem;
}

/* ===== Responsive ===== */
@media (max-width: 1024px) {
  .personality-glass-card {
    grid-template-columns: 1fr;
    text-align: center;
  }

  .p-left-col {
    order: -1;
  }
}

@media (max-width: 768px) {
  .result {
    padding: 1.5rem;
  }

  .result-header {
    flex-wrap: wrap;
    gap: 1rem;
    justify-content: center;
  }

  .back-home-btn span,
  .share-btn span {
    display: none;
  }

  .result-title {
    order: -1;
    width: 100%;
    text-align: center;
    font-size: 1.35rem;
  }

  .personality-glass-card {
    padding: 2rem 1.5rem;
  }

  .personality-name {
    font-size: 1.75rem;
  }

  .chart-wrapper > div {
    height: 340px !important;
  }

  .action-buttons-row {
    flex-direction: column;
  }

  .action-btn-primary,
  .action-btn-secondary {
    width: 100%;
    justify-content: center;
  }
}
/* 概览按视口分配留白，长评语独立下移；只约束最小高度，矮屏/大字号时允许自然滚动，不裁切内容。 */
.result-brand { margin: 0; color: #8a7542; font-size: 0.88rem; text-align: center; }
.cooperation-link { display: inline-flex; align-items: center; justify-content: center; min-width: 44px; min-height: 44px; padding: 0 4px; box-sizing: border-box; color: #796436; font-size: 0.9rem; text-decoration: none; flex-shrink: 0; }
.cooperation-link:hover { color: #54431e; text-decoration: underline; text-underline-offset: 4px; }
.cooperation-link:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; border-radius: 6px; }
.result-overview-actions { display: grid; grid-template-columns: auto auto; align-items: center; justify-content: center; gap: 9px 1rem; }
.invite-share-btn { grid-column: 1 / -1; justify-self: center; display: inline-flex; align-items: center; justify-content: center;
  gap: 8px; width: 100%; padding: 9px 22px; border: 1px solid #dcc989; border-radius: 999px;
  background: #fff7d7; color: #725d28; font: inherit; font-size: 0.86rem; font-weight: 600; cursor: pointer; }
.invite-share-btn:hover { background: #f9edba; }
.invite-share-btn:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; }
.result-review-link { color: #7d6b40; font-size: 0.85rem; text-decoration: none; padding: 0.65rem 0.5rem; }
.result-review-link:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; border-radius: 6px; }
.result.result-compact { padding: 16px; }
.result-compact .result-container { max-width: 860px; }
.result-compact .result-overview { min-height: calc(100svh - 32px); display: grid;
  grid-template-rows: auto 1fr auto auto; gap: 14px; padding-bottom: 12px; box-sizing: border-box; }
.result-compact .result-header { margin: 0; flex-wrap: nowrap; justify-content: space-between; gap: 8px; }
.result-compact .back-home-btn, .result-compact .share-btn { padding: 8px 10px; border-radius: 999px; box-shadow: none; }
.result-compact .personality-card-section { display: grid; margin: 0; }
.result-compact .personality-glass-card { display: flex; flex-direction: column; justify-content: center;
  align-items: center; padding: 16px 24px; gap: 8px; text-align: center; box-shadow: none; }
.result-compact .p-left-col { gap: 4px; }
.result.result-compact .frog-result-mascot { width: clamp(120px, 25svh, 240px); height: clamp(120px, 25svh, 240px); margin: 0; }
.result-compact .p-right-col { align-items: center; gap: 8px; min-width: 0; }
.personality-heading { text-align: inherit; }
.personality-identity { margin: 0 0 3px; color: #8a7542; font-size: clamp(0.72rem, 2.5vw, 0.82rem); font-weight: 400; line-height: 1.4; letter-spacing: 0.08em; }
.result-compact .personality-name { margin: 0; font-size: clamp(1.65rem, 4.5vw, 2.4rem); }
.result-compact .personality-meme { max-width: 620px; margin: 0; font-size: clamp(0.88rem, 2.5vw, 1.05rem);
  line-height: 1.65; font-style: normal; overflow-wrap: anywhere; }
.result-compact .frog-tags { justify-content: center; gap: 6px; }
.result-compact .frog-tags span { padding: 3px 9px; font-size: 0.75rem; }
.result-compact .frog-relations { margin: 0; }
.result-compact .frog-relations-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.result-compact .frog-relation-card { padding: 10px 8px; border-radius: 18px; background: #fffcf4; }
.result-compact .frog-relation-title { min-height: 2.8em; margin: 0 0 4px; font-size: 0.76rem; line-height: 1.4; }
.result-compact .frog-relation-figures { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.result-compact .frog-relation-mascot { display: block; width: min(76px, 100%); height: 76px; margin: 0 auto 4px; }
.result-compact .frog-relation-name { font-size: 0.8rem; line-height: 1.4; }
.result-compact .frog-relations-note { margin-top: 8px; font-size: 0.68rem; line-height: 1.5; }
.result-compact .result-overview-actions :deep(.poster-trigger) { width: auto; padding: 9px 22px; border-radius: 999px; font-size: 0.86rem; }
.result-compact .frog-persona-review { margin: 32px 0 0; padding-top: 8px; }
.result-compact .frog-persona-review .section-title-heading { scroll-margin-top: 20px; }
@media (min-width: 900px) and (min-height: 650px) {
  .result-compact .personality-glass-card { flex-direction: row; gap: 32px; padding: 24px 32px; }
  .result-compact .p-right-col { flex: 1; }
  .result.result-compact .frog-result-mascot { width: 240px; height: 260px; }
}
@media (max-width: 480px) {
  .result.result-compact { padding: 12px; }
  .result-compact .result-overview { min-height: calc(100svh - 24px); gap: 10px; }
  .result-compact .personality-glass-card { padding: 12px 16px; }
  .result-compact .frog-relations-grid { gap: 8px; }
  .result-compact .frog-relation-mascot { height: 64px; }
  .result-compact .result-brand { font-size: 0.8rem; }
}
@media (max-height: 700px) {
  .result-compact .result-overview { gap: 6px; padding-bottom: 10px; }
  .result-compact .personality-glass-card { padding: 6px 14px; gap: 4px; }
  .result.result-compact .frog-result-mascot { width: clamp(90px, 19svh, 130px); height: clamp(90px, 19svh, 130px); }
  .result-compact .personality-name { font-size: 1.55rem; }
  .result-compact .personality-meme { font-size: 0.82rem; line-height: 1.5; }
  .result-compact .p-right-col { gap: 5px; }
  .result-compact .frog-relation-card { padding: 7px 6px; }
  .result-compact .frog-relation-mascot { height: 48px; }
  .result-compact .frog-relation-name { font-size: 0.75rem; }
}
</style>
