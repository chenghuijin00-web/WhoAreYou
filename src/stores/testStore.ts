import { defineStore } from 'pinia';
import { TestEngine } from '../core/testEngine';
import { themeManager } from '../xbti/themeManager';
import { selectPersonaMeme } from '../core/personaMeme';
import { trackUsage } from '../core/usageTracking';
import type { TestResult, TestConfig } from '../protocol/types';

export const useTestStore = defineStore('test', {
  state: () => ({
    testEngine: new TestEngine(),
    currentQuestionIndex: 0,
    answers: {} as Record<string, string>,
    result: null as TestResult | null,
    isTestStarted: false,
    isTestCompleted: false,
    currentThemeId: '' as string
  }),

  getters: {
    currentTheme: (state): TestConfig | null => {
      if (!state.currentThemeId) return null;
      return themeManager.getTheme(state.currentThemeId) || null;
    },

    currentQuestion: (state) => {
      if (!state.isTestStarted || !state.currentThemeId) return null;
      const theme = themeManager.getTheme(state.currentThemeId);
      return theme?.questions[state.currentQuestionIndex] || null;
    },

    progress: (state) => {
      if (!state.isTestStarted || !state.currentThemeId) return 0;
      const theme = themeManager.getTheme(state.currentThemeId);
      if (!theme) return 0;
      return ((state.currentQuestionIndex) / theme.questions.length) * 100;
    },

    isLastQuestion: (state) => {
      if (!state.isTestStarted || !state.currentThemeId) return false;
      const theme = themeManager.getTheme(state.currentThemeId);
      if (!theme) return false;
      return state.currentQuestionIndex === theme.questions.length - 1;
    },

    totalQuestions: (state) => {
      if (!state.currentThemeId) return 0;
      const theme = themeManager.getTheme(state.currentThemeId);
      return theme?.questions.length || 0;
    },

    allThemes: () => {
      return themeManager.getAllThemes();
    }
  },

  actions: {
    setTheme(themeId: string) {
      if (themeManager.getTheme(themeId)) {
        this.currentThemeId = themeId;
        this.resetTest();
      }
    },

    registerTheme(theme: TestConfig) {
      themeManager.registerTheme(theme);
    },

    startTest() {
      if (!this.currentThemeId) return;
      const theme = themeManager.getTheme(this.currentThemeId);
      if (!theme) return;

      this.testEngine.registerTest(theme);
      this.testEngine.startTest(theme.id);
      this.currentQuestionIndex = 0;
      this.answers = {};
      this.result = null;
      this.isTestStarted = true;
      this.isTestCompleted = false;
      trackUsage('test_start');
    },

    submitAnswer(optionId: string) {
      if (!this.isTestStarted || this.isTestCompleted) return;

      const currentQuestion = this.currentQuestion;
      if (!currentQuestion) return;

      this.testEngine.submitAnswer(currentQuestion.id, optionId);
      this.answers[currentQuestion.id] = optionId;

      this.currentQuestionIndex++;

      const theme = themeManager.getTheme(this.currentThemeId);
      if (!theme) return true;
      if (this.currentQuestionIndex >= theme.questions.length) {
        trackUsage('test_finish');
        return true;
      }
      
      return false;
    },

    goToPreviousQuestion() {
      if (!this.isTestStarted || this.currentQuestionIndex <= 0) return;

      // 保留已答选项供返回时回显；重新提交时由引擎覆盖，不累加旧分数。
      this.currentQuestionIndex--;
    },

    completeTest() {
      if (!this.isTestStarted || (this.isTestCompleted && this.result)) return;

      const result = this.testEngine.getResult();
      const persona = this.currentTheme?.personalityTypes.find(type => type.id === result.personality_type);
      // 只在完成时抽取一次，重入结果页、生成海报和分享不能改变同一次测试的短评。
      this.result = persona?.memeVariants?.length ? { ...result, display_meme: selectPersonaMeme(persona) } : result;
      this.isTestCompleted = true;
    },

    /** 用户主动换短评，只改display_meme，不重新计分、不清空答案或改变角色。 */
    refreshMeme() {
      if (!this.isTestCompleted || !this.result) return;
      const persona = this.currentTheme?.personalityTypes.find(type => type.id === this.result?.personality_type);
      if (!persona?.memeVariants || persona.memeVariants.length < 2) return;
      this.result.display_meme = selectPersonaMeme(persona, undefined, this.result.display_meme || persona.meme);
    },

    resetTest() {
      this.testEngine.resetTest();
      this.currentQuestionIndex = 0;
      this.answers = {};
      this.result = null;
      this.isTestStarted = false;
      this.isTestCompleted = false;
    }
  }
});
