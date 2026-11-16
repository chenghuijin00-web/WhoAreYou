import type { PersonalityType } from '../protocol/types.ts';

/** 只随机展示短评，不参与计分；完成测试或用户主动刷新时保存一次，页面/分享/海报复用。 */
export function selectPersonaMeme(persona: PersonalityType | undefined, random: () => number = Math.random, previous?: string): string {
  if (!persona) return '';
  const pool = [...new Set((persona.memeVariants ?? [persona.meme]).filter(text => typeof text === 'string' && text.trim()).map(text => text.trim()))];
  // 有其他候选时排除当前句，避免点击刷新却没有变化；只有一句时保留兼容回退。
  const choices = pool.length > 1 ? pool.filter(text => text !== previous) : pool;
  if (!choices.length) return persona.meme;
  const value = random();
  const index = Number.isFinite(value) ? Math.min(choices.length - 1, Math.max(0, Math.floor(value * choices.length))) : 0;
  return choices[index];
}
