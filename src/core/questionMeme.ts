import reviews from '../instance/naifrog-abstract-reviews.json' with { type: 'json' };

/** 每轮答题预先随机分配短评，同题返回/改选不变，不读取答案或参与计分。 */
export function createQuestionNotes(questionIds: string[], random: () => number = Math.random): Record<string, string> {
  const pool = [...reviews];
  for (let i = pool.length - 1; i > 0; i--) {
    const value = random();
    const index = Number.isFinite(value) ? Math.max(0, Math.min(i, Math.floor(value * (i + 1)))) : 0;
    [pool[i], pool[index]] = [pool[index], pool[i]];
  }
  return Object.fromEntries(questionIds.map((id, index) => [id, pool[index % pool.length] ?? '']));
}
