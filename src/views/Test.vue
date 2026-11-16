<template>
  <div class="test">
    <!-- Header -->
    <div class="test-header">
      <button class="back-btn" @click="goBack" aria-label="返回">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M19 12H5M12 19l-7-7 7-7"/>
        </svg>
        <span>返回</span>
      </button>

      <div class="progress-container">
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
        </div>
        <span class="progress-text">{{ Math.min(currentQuestionIndex + 1, totalQuestions) }} / {{ totalQuestions }}</span>
      </div>

      <div class="theme-tag">
        <span>奶族身份确认中</span>
      </div>
    </div>

    <div class="frog-question-note">
      <img :src="mascotAssets.curious" alt="" width="64" height="64" decoding="async" />
      <p>{{ questionNote }}</p>
    </div>

    <!-- Question Card with Animation -->
    <transition 
      name="question-transition"
      mode="out-in"
      @after-enter="isQuestionTransitioning = false"
    >
      <div v-if="currentQuestion && !showDistillation" :key="currentQuestion.id" :data-question-id="currentQuestion.id" class="question-wrapper">
        <div class="question-card">
          <!-- 题号与场景共享同一留白区域，窄屏时标题在区域内换行。 -->
          <div class="question-meta">
            <div class="q-number-badge">
              <span>Q{{ currentQuestionIndex + 1 }}</span>
            </div>
            <p v-if="currentQuestion.scene" class="question-scene">
              <span class="question-scene-label">{{ currentQuestion.scene }}</span>
              <span v-if="currentQuestion.title" class="question-scene-title">{{ currentQuestion.title }}</span>
            </p>
          </div>

          <!-- Question Text -->
          <h2 class="q-text">{{ currentQuestion.text }}</h2>

          <!-- Options List -->
          <div class="options-grid">
            <button
              v-for="(option, idx) in currentQuestion.options"
              :key="option.id"
              class="option-card"
              :aria-pressed="selectedOption === option.id"
              :disabled="isQuestionTransitioning || isFinishing"
              :class="{ 
                selected: selectedOption === option.id,
                [`stagger-${idx}`]: true
              }"
              @click="selectOption(option.id, $event)"
            >
              <span class="opt-text">{{ option.text }}</span>
              
              <div class="opt-check-icon" aria-hidden="true">
                <img :src="mascotAssets.eye" alt="" width="32" height="32" draggable="false" decoding="async" />
                <span class="opt-eye-pupil"></span>
              </div>
            </button>
          </div>

          <!-- Navigation Buttons (Left: Previous, Right: Next/Distill) -->
          <div class="navigation-area">
            <button
              class="nav-btn prev-btn"
              :disabled="currentQuestionIndex === 0 || isQuestionTransitioning || isFinishing"
              @click="goToPreviousQuestion"
              aria-label="上一题"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M15 18l-6-6 6-6"/>
              </svg>
              <span>上一题</span>
            </button>

            <button
              v-if="!isLastQuestion"
              class="nav-btn next-btn"
              :disabled="!selectedOption || isQuestionTransitioning || isFinishing"
              :class="{ active: selectedOption }"
              @click="submitAndNext"
              aria-label="下一题"
            >
              <span>下一题 →</span>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 18l6-6-6-6"/>
              </svg>
            </button>

            <button
              v-else
              class="nav-btn distill-btn"
              :disabled="!selectedOption || isQuestionTransitioning || isFinishing"
              :class="{ active: selectedOption }"
              @click="startDistillation"
              aria-label="开始蒸馏"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M9 3v14l8.5-7L9 3z"/>
              </svg>
              <span>开始蒸馏</span>
              <div class="btn-shine"></div>
            </button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Loading State -->
    <div v-if="!currentQuestion && !showDistillation" class="loading-view">
      <div class="spinner-ring"></div>
      <p>准备中...</p>
    </div>

    <!-- Distillation Animation Overlay (teleported to body for proper centering) -->
    <Teleport to="body">
      <transition name="distill-fade">
        <div v-if="showDistillation" class="distill-overlay" role="status" aria-live="polite" :aria-label="isResultReady ? '奶蛙种族判定完成，请查看结果' : '正在判定奶蛙种族'">
          <div class="distill-content">
            <section class="distill-ads" aria-labelledby="distill-ads-title">
              <h2 id="distill-ads-title" class="distill-ads-title">广告位招租中</h2>
              <div class="distill-ad-grid">
                <div v-for="slot in 4" :key="slot" class="distill-ad-placeholder" role="img" :aria-label="`待出租广告位 ${slot}，虚位等待`">
                  <span class="distill-ad-copy">虚位等待..</span>
                </div>
              </div>
            </section>
            <LoadingBarrage />
            <div class="distill-result-action">
              <h3 v-if="!isResultReady" class="distill-heading">正在判定奶蛙种族</h3>
              <button v-else class="distill-result-btn" :disabled="isOpeningResult" @click="goToResult">
                {{ isOpeningResult ? '正在打开…' : '查看结果 →' }}
              </button>
              <p v-if="resultOpenError" class="distill-result-error" role="alert">{{ resultOpenError }}</p>
            </div>
          </div>
        </div>
      </transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { mascotAssets } from '../assets/mascotAssets';
import LoadingBarrage from '../components/LoadingBarrage.vue';
import { createQuestionNotes } from '../core/questionMeme';
import { computed, ref, onMounted, watch, onBeforeUnmount } from 'vue';
import { useRouter } from 'vue-router';
import { useTestStore } from '../stores/testStore';

const router = useRouter();
const testStore = useTestStore();

const selectedOption = ref<string | null>(null);
const isQuestionTransitioning = ref(false);
const showDistillation = ref(false);
const isResultReady = ref(false);
const isOpeningResult = ref(false);
const resultOpenError = ref('');

const currentQuestion = computed(() => testStore.currentQuestion);
const currentQuestionIndex = computed(() => testStore.currentQuestionIndex);
const isLastQuestion = computed(() => testStore.isLastQuestion);
const progress = computed(() => testStore.progress);
const totalQuestions = computed(() => testStore.totalQuestions);
const questionNotes = createQuestionNotes(testStore.currentTheme?.questions.map(question => question.id) ?? []);
const questionNote = computed(() => questionNotes[currentQuestion.value?.id ?? ''] ?? '');

let resultTimer: ReturnType<typeof setTimeout>;
let isFinishing = false;
const AUTO_ADVANCE_DELAY_MS = 450;
const RESULT_LOADING_MS = 5000;
let autoAdvanceTimer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;

/** 取消当前题的待提交任务；翻题、手动提交、退出与销毁都不能遗留旧题计时器。 */
const cancelAutoAdvance = () => {
  clearTimeout(autoAdvanceTimer);
  autoAdvanceTimer = undefined;
};

onBeforeUnmount(() => {
  disposed = true;
  cancelAutoAdvance();
  clearTimeout(resultTimer);
});

const selectOption = (optionId: string, event: MouseEvent) => {
  // 离场DOM仍可能接收点击；按DOM上的题号隔离，不能把旧选项写入已经切换的新题。
  const questionId = (event.currentTarget as HTMLElement).closest<HTMLElement>('.question-wrapper')?.dataset.questionId;
  if (isFinishing || isQuestionTransitioning.value || questionId !== currentQuestion.value?.id) return;
  if (!currentQuestion.value?.options.some(option => option.id === optionId)) return;
  selectedOption.value = optionId;
  // 首次选择确定截止时间，之后只更新选项，不重启计时；到期读取最后的选择。
  if (autoAdvanceTimer !== undefined) return;
  autoAdvanceTimer = setTimeout(() => {
    autoAdvanceTimer = undefined;
    if (questionId !== currentQuestion.value?.id || isFinishing || isQuestionTransitioning.value) return;
    submitAndNext();
  }, AUTO_ADVANCE_DELAY_MS);
};

// 每次切题读取已提交选项，返回改答不再丢失原选择。
watch(currentQuestion, question => {
  cancelAutoAdvance();
  selectedOption.value = question ? testStore.answers[question.id] || null : null;
}, { immediate: true, flush: 'sync' });

const submitAndNext = () => {
  if (!selectedOption.value || isFinishing || isQuestionTransitioning.value) return;
  cancelAutoAdvance();
  if (isLastQuestion.value) {
    startDistillation();
    return;
  }
  isQuestionTransitioning.value = true;
  testStore.submitAnswer(selectedOption.value);
};

const goToPreviousQuestion = () => {
  if (isFinishing || isQuestionTransitioning.value) return;
  if (testStore.currentQuestionIndex > 0) {
    cancelAutoAdvance();
    isQuestionTransitioning.value = true;
    testStore.goToPreviousQuestion();
  }
};

const startDistillation = () => {
  if (isFinishing || isQuestionTransitioning.value || !isLastQuestion.value || !selectedOption.value) return;
  cancelAutoAdvance();
  isFinishing = true;
  
  // Submit last answer if not already submitted
  if (selectedOption.value) {
    testStore.submitAnswer(selectedOption.value);
    selectedOption.value = null;
  }

  showDistillation.value = true;
  isResultReady.value = false;
  resultTimer = setTimeout(() => {
    if (!disposed && showDistillation.value) isResultReady.value = true;
  }, RESULT_LOADING_MS);
};

/** 五秒仅解锁按钮，由用户主动查看结果；同步锁防止重复计算、重复导航，失败可重试。 */
const goToResult = async () => {
  if (disposed || !showDistillation.value || !isResultReady.value || isOpeningResult.value) return;
  isOpeningResult.value = true;
  resultOpenError.value = '';
  try {
    if (!testStore.isTestCompleted) testStore.completeTest();
    await router.push('/result');
  } catch (error) {
    console.error('打开奶蛙结果失败', error);
    resultOpenError.value = '暂时未能打开结果，请再点一次。';
  } finally {
    isOpeningResult.value = false;
  }
};

const goBack = () => {
  if (confirm('确定要退出吗？当前进度将会丢失。')) {
    cancelAutoAdvance();
    testStore.resetTest();
    router.push('/');
  }
};

onMounted(() => {
  if (!testStore.isTestStarted) {
    router.replace('/');
    return;
  }
  // 浏览器返回可能重入已提交最后一题的页面：恢复已有结果，而不是显示永久加载。
  if (testStore.isTestCompleted && testStore.result) {
    router.replace('/result');
    return;
  }
  if (!currentQuestion.value) {
    const questions = testStore.currentTheme?.questions ?? [];
    const allAnswered = questions.length > 0 && questions.every(question =>
      question.options.some(option => option.id === testStore.answers[question.id]));
    if (allAnswered) {
      testStore.completeTest();
      router.replace('/result');
    } else {
      testStore.resetTest();
      router.replace('/');
    }
  }
});
</script>

<style scoped>
.question-meta {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.85rem;
  margin: 2rem 2.5rem 1rem;
}

.question-scene {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem 0.65rem;
  min-width: 0;
  margin: 0;
  color: #84713c;
  font-size: 0.875rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.question-scene-label {
  flex-shrink: 0;
  font-weight: 600;
  color: #67531e;
}

.question-scene-title {
  min-width: 0;
  color: #796b45;
}

@media (max-width: 480px) {
  .question-scene {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
  }
}

/* ===== Global Styles ===== */
.test {
  min-height: 100vh;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  color: #1e293b;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  padding: 2rem;
  overflow-y: auto;
}

/* ===== Header ===== */
.test-header {
  display: flex;
  align-items: center;
  gap: 1.8rem;
  margin-bottom: 2.5rem;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.back-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.1rem;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  color: #64748b;
  cursor: pointer;
  transition: all 0.3s ease;
  font-size: 0.88rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.back-btn:hover {
  border-color: #0ea5e9;
  color: #0ea5e9;
  transform: translateX(-4px);
}

.progress-container {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress-bar {
  flex: 1;
  height: 6px;
  background: #e2e8f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #0ea5e9, #8b5cf6);
  border-radius: 3px;
  transition: width 0.5s cubic-bezier(0.23, 1, 0.32, 1);
  box-shadow: 0 0 10px rgba(14, 165, 233, 0.35);
}

.progress-text {
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  min-width: 48px;
  text-align: right;
  font-family: 'SF Mono', Monaco, monospace;
}

.theme-tag {
  padding: 0.55rem 1.1rem;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;
  color: #0369a1;
  font-size: 0.84rem;
  font-weight: 600;
}

/* ===== Question Card ===== */
.question-wrapper {
  max-width: 900px;
  margin: 0 auto;
}

.question-card {
  background: white;
  border-radius: 22px;
  box-shadow: 
    0 4px 20px rgba(0, 0, 0, 0.06),
    0 1px 4px rgba(0, 0, 0, 0.04);
  border: 1px solid #f1f5f9;
  overflow: hidden;
}

.q-number-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 1.1rem;
  background: linear-gradient(135deg, #f0f9ff, #ede9fe);
  border: 1px solid #bae6fd;
  border-radius: 18px;
  margin: 0;
  align-self: center;
}

.q-number-badge span {
  color: #0ea5e9;
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  font-family: 'SF Mono', Monaco, monospace;
}

.q-text {
  font-size: 1.5rem;
  line-height: 1.5;
  color: #1e293b;
  font-weight: 600;
  margin: 0 2.5rem 2rem;
  letter-spacing: -0.01em;
}

/* ===== Options ===== */
.options-grid {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0 2.5rem;
  margin-bottom: 2.2rem;
}

.option-card {
  -webkit-tap-highlight-color: transparent;
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: 1.15rem 1.35rem;
  background: #fafafa;
  border: 1.5px solid #f1f5f9;
  border-radius: 13px;
  cursor: pointer;
  transition: all 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;
  text-align: left;
}

.option-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.04), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
}

/* 触屏浏览器会保留模拟hover，切题后不能让它看起来像已选中。 */
@media (hover: hover) and (pointer: fine) {
.option-card:hover::after {
  opacity: 1;
}

.option-card:hover {
  background: white;
  border-color: #bae6fd;
  transform: translateX(7px);
  box-shadow: 0 4px 16px rgba(14, 165, 233, 0.08);
}
}
.option-card:focus-visible { outline: 2px solid #9e8036; outline-offset: 3px; }

.option-card.selected {
  background: #f0f9ff;
  border-color: #0ea5e9;
  box-shadow: 
    0 0 25px rgba(14, 165, 233, 0.12),
    inset 0 0 16px rgba(14, 165, 233, 0.04);
}

.option-card.selected .opt-check-icon {
  opacity: 1;
  transform: scale(1);
}

.opt-text {
  flex: 1;
  line-height: 1.5;
  color: #334155;
  font-size: 1rem;
}

.opt-check-icon {
  position: relative;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  pointer-events: none;
  opacity: 0;
  transform: scale(0.5);
  transition: opacity 0.12s ease-out, transform 0.12s ease-out;
}

.opt-check-icon img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

/* 仅瞳孔移动，虹膜保持不动；320ms内看向左侧，不改变450ms自动提交截止时间。 */
.opt-eye-pupil {
  position: absolute;
  width: 16px;
  height: 16px;
  top: 8px;
  left: 8px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 30%, #222c21, #0b100a 75%);
  transform: translate(-4px, 1px);
}

.opt-eye-pupil::after {
  content: '';
  position: absolute;
  top: 3px;
  left: 4px;
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #ffffff80;
}

.option-card.selected .opt-eye-pupil {
  animation: eye-look-left 0.32s ease-in-out both;
}

@keyframes eye-look-left {
  from { transform: translate(4px, 1px); }
  to { transform: translate(-4px, 1px); }
}

@media (prefers-reduced-motion: reduce) {
  .opt-check-icon { transition: none; }
  .option-card.selected .opt-eye-pupil { animation: none; }
}

/* Stagger delays */
.stagger-0 { animation-delay: 0s; }
.stagger-1 { animation-delay: 0.06s; }
.stagger-2 { animation-delay: 0.12s; }

/* ===== Navigation Area ===== */
.navigation-area {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2.5rem 2.2rem;
  gap: 1.5rem;
}

.nav-btn {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  padding: 0.95rem 1.8rem;
  background: white;
  border: 1.5px solid #e2e8f0;
  border-radius: 13px;
  color: #64748b;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  position: relative;
  overflow: hidden;
}

.nav-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  transform: none !important;
}

.prev-btn:not(:disabled):hover {
  border-color: #94a3b8;
  color: #334155;
  transform: translateX(-4px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.06);
}

.next-btn.active,
.distill-btn.active {
  background: linear-gradient(135deg, #0ea5e9, #8b5cf6);
  border-color: transparent;
  color: white;
  box-shadow: 0 7px 26px rgba(14, 165, 233, 0.32);
}

.next-btn.active:hover:not(:disabled),
.distill-btn.active:hover:not(:disabled) {
  transform: translateY(-3px) scale(1.03);
  box-shadow: 0 10px 36px rgba(14, 165, 233, 0.42);
}

.btn-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.28),
    transparent
  );
  transition: left 0.55s ease;
}

.distill-btn.active:hover .btn-shine {
  left: 100%;
}

/* ===== Transitions - PURE opacity (no movement, will-change for GPU acceleration) ===== */
.question-transition-enter-active {
  transition: opacity 0.18s ease-out;
  will-change: opacity;
}

.question-transition-leave-active {
  transition: opacity 0.12s ease-in;
  will-change: opacity;
}

.question-transition-enter-from,
.question-transition-leave-to {
  opacity: 0;
}

.distill-fade-enter-active,
.distill-fade-leave-active {
  transition: all 0.45s ease;
}

.distill-fade-enter-from,
.distill-fade-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

/* ===== Distillation Animation ===== */
.distill-overlay {
  position: fixed;
  inset: 0;
  background: #fffaf0;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 999;
  overflow-y: auto;
  padding: max(20px, env(safe-area-inset-top)) max(18px, env(safe-area-inset-right)) max(20px, env(safe-area-inset-bottom)) max(18px, env(safe-area-inset-left));
}

.distill-content {
  text-align: center;
  width: 100%;
  max-width: 680px;
  margin-block: auto;
  flex-shrink: 0;
}

.distill-ads {
  margin-bottom: 1.4rem;
}

.distill-ads-title {
  margin: 0 0 0.75rem;
  color: #756335;
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.distill-ad-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
}

.distill-ad-placeholder {
  display: grid;
  place-items: center;
  min-height: 64px;
  border: 1px dashed #d8cda9;
  border-radius: 14px;
  background: #fff;
  box-shadow: 0 3px 12px #76602306;
}

.distill-ad-copy {
  color: #847044;
  font-size: 0.82rem;
  font-weight: 500;
  letter-spacing: 0.12em;
}

.distill-heading {
  font-size: clamp(1.15rem, 3.6vw, 1.65rem);
  font-weight: 700;
  color: #3a351f;
  margin-bottom: 0.7rem;
  line-height: 1.5;
}

.distill-result-action { min-height: 52px; display: grid; place-items: center; }
.distill-result-btn { padding: 0.75rem 2.3rem; border: 1px solid #d4b850; border-radius: 999px;
  background: #f1d875; color: #3a351f; font: inherit; font-weight: 700; cursor: pointer;
  box-shadow: 0 4px 0 #c9ad48; transition: transform 0.15s, box-shadow 0.15s; }
.distill-result-btn:hover { background: #f6df87; }
.distill-result-btn:active { transform: translateY(3px); box-shadow: 0 1px 0 #c9ad48; }
.distill-result-btn:focus-visible { outline: 3px solid #8b7028; outline-offset: 4px; }
.distill-result-btn:disabled { opacity: 0.65; cursor: wait; }
.distill-result-error { color: #9e3d28; font-size: 0.8rem; margin-top: 0.75rem; }

/* ===== Loading ===== */
.loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: fixed;
  inset: 0;
  background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
  gap: 1.8rem;
  z-index: 10;
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
@media (max-width: 768px) {
  .test {
    padding: 1.5rem;
  }

  .test-header {
    flex-wrap: wrap;
    gap: 1rem;
  }

  .back-btn span {
    display: none;
  }

  .progress-container {
    order: 3;
    flex-basis: 100%;
  }

  .theme-tag {
    font-size: 0.8rem;
    padding: 0.48rem 1rem;
  }

  .question-meta {
    margin: 1.5rem 1.5rem 1rem;
    gap: 0.75rem;
  }

  .q-text {
    font-size: 1.28rem;
    margin-left: 1.5rem;
    margin-right: 1.5rem;
  }

  .options-grid {
    padding: 0 1.5rem;
  }

  .option-card {
    padding: 1rem 1.15rem;
  }

  .opt-text {
    font-size: 0.96rem;
  }

  .navigation-area {
    flex-direction: column;
    padding: 1.5rem;
    gap: 1rem;
  }

  .nav-btn {
    width: 100%;
    justify-content: center;
  }

  .distill-content {
    max-width: 440px;
  }

}

@media (max-height: 700px) {
  .distill-ads { margin-bottom: 1rem; }
  .distill-ad-placeholder { min-height: 44px; }
  .distill-heading { margin-bottom: 0.35rem; }
}
</style>
