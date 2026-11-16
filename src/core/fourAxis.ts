import type { TestConfig, TestResult, PreferenceScore, Question } from '../protocol/types.ts';
import { scoreKeyedScales } from './keyedScale.ts';
import type { KeyedScaleScore } from './keyedScale.ts';

const axes = [
  { id: 'ei', left: 'I', right: 'E', leftLabel: '独处充电', rightLabel: '互动充电' },
  { id: 'sn', left: 'S', right: 'N', leftLabel: '具体经验', rightLabel: '联想可能' },
  { id: 'tf', left: 'T', right: 'F', leftLabel: '逻辑标准', rightLabel: '价值与感受' },
  { id: 'jp', left: 'J', right: 'P', leftLabel: '提前确定', rightLabel: '保留弹性' }
] as const;

/** 按轴汇总实际强度；娱乐皮肤决胜与原始计分分离，保留旧配置的保守展示行为。 */
function scoreAxis(test: TestConfig, answers: Record<string, string>, axis: typeof axes[number], keyed?: KeyedScaleScore[]): PreferenceScore {
  const questions = test.questions.filter(q => q.options.some(o => axis.id in o.scores));
  if (questions.length === 0) throw new Error('每组偏好必须配置题目');
  let rightVotes = 0;
  for (const question of questions) {
    const votes = question.options.map(option => option.scores[axis.id]);
    if (votes.some(vote => !Number.isFinite(vote) || vote < 0 || vote > 1)) throw new Error('偏好选项强度必须位于 0～1');
    const option = question.options.find(item => item.id === answers[question.id]);
    if (!option) throw new Error('请完成所有题目后查看结果');
    rightVotes += option.scores[axis.id] * (test.scaleScoring === 'semantic_weighted' ? question.scoringWeight ?? 1 : 1);
  }
  const raw = keyed?.find(score => score.scale === axis.id);
  if (keyed && !raw) throw new Error('计分结果缺少配置的维度');
  const semantic = test.scaleScoring === 'semantic_weighted';
  const totalWeight = semantic ? questions.reduce((sum, question) => sum + (question.scoringWeight ?? 1), 0) : questions.length;
  const normalized = raw ? raw.normalized : rightVotes / totalWeight;
  // 小数权重相加可能出现浮点尾差；仅消除机器误差，不把真实的小分差改成平分。
  const ratio = semantic && Math.abs(normalized - 0.5) < 1e-12 ? 0.5 : normalized;
  const rightPercent = Math.round(ratio * 100);
  return {
    ...(raw ? { raw_total: raw.rawTotal, raw_minimum: raw.minimum, raw_maximum: raw.maximum, item_count: raw.itemCount } : {}),
    ...(semantic ? { scoring_method: 'semantic_weighted' as const, weight_total: totalWeight,
      raw_total: rightVotes, raw_minimum: 0, raw_maximum: totalWeight, item_count: questions.length } : {}),
    dimension: axis.id, left: axis.left, right: axis.right,
    left_label: axis.leftLabel, right_label: axis.rightLabel,
    left_percent: 100 - rightPercent, right_percent: rightPercent,
    ...resolveAxisLetter(test, answers, questions, axis, ratio),
    // 仅标记分差较小，不是统计置信区间；娱乐模式不会因此隐藏字母或皮肤。
    close: ratio >= 0.35 && ratio <= 0.65
  };
}

/** 平分按固定题号的首个非中立选择决胜；全中立固定送 INFP 皮肤，不伪造偏好证据。 */
function resolveAxisLetter(test: TestConfig, answers: Record<string, string>, questions: Question[],
  axis: typeof axes[number], ratio: number): Pick<PreferenceScore, 'letter' | 'resolution' | 'tie_break_question_id'> {
  const letter = ratio > 0.5 ? axis.right : axis.left;
  if (test.typeResolution !== 'entertainment') return { letter };
  if (ratio !== 0.5) return { letter, resolution: 'majority' };
  const decisive = [...questions].sort((a, b) => a.id.localeCompare(b.id)).find(question =>
    question.options.find(option => option.id === answers[question.id])!.scores[axis.id] !== 0.5);
  if (decisive) {
    const score = decisive.options.find(option => option.id === answers[decisive.id])!.scores[axis.id];
    return { letter: score > 0.5 ? axis.right : axis.left, resolution: 'tie_break', tie_break_question_id: decisive.id };
  }
  const defaults = { ei: 'I', sn: 'N', tf: 'F', jp: 'P' };
  return { letter: defaults[axis.id], resolution: 'fallback' };
}

/** 弱倾向仍展示字母；平分和默认赠送必须说清来源，不将娱乐选择宣称为测量证据。 */
function describeAxis(axis: PreferenceScore): string {
  const prefix = `${axis.left}/${axis.right}：`;
  if (axis.resolution === 'fallback') return `${prefix}${axis.scoring_method === 'semantic_weighted' ? '本组回答未提供明确方向' : '本组全部选中间'}，未测出倾向；默认赠送 ${axis.letter} 侧娱乐皮肤。`;
  if (axis.resolution === 'tie_break') return `${prefix}本次两侧平分，按情境题 ${axis.tie_break_question_id} 的选择，分配 ${axis.letter} 侧娱乐皮肤。`;
  if (axis.resolution === 'majority') return `${prefix}本次回答更偏向${axis.letter === axis.left ? axis.left_label : axis.right_label}${axis.close ? '，分差较小，另一面的你也在' : ''}。`;
  return axis.close ? `${prefix}本次两侧接近，暂不判断你稳定偏向哪侧。`
    : `${prefix}本次回答更偏向${axis.letter === axis.left ? axis.left_label : axis.right_label}，不代表你在每个场景中都如此。`;
}

/** 娱乐模式输出完整类型；默认保留含 X 的旧展示。百分比不是准确率或人口占比。 */
export function calculateFourAxisResult(test: TestConfig, answers: Record<string, string>): TestResult {
  if (test.scaleScoring === 'semantic_weighted') validateSemanticResponses(test, answers);
  const keyed = test.scaleScoring === 'ipip_sum' ? calculateKeyedScores(test, answers) : undefined;
  const preferences = axes.map(axis => scoreAxis(test, answers, axis, keyed));
  const code = preferences.map(axis => axis.letter).join('');
  const persona = test.personalityTypes.find(type => type.id === code);
  if (!persona) throw new Error(`缺少 ${code} 的人格皮肤`);
  const dimensions = Object.fromEntries(preferences.map(axis => [axis.dimension, 1 + axis.right_percent / 50]));
  const displayCode = test.typeResolution === 'entertainment' ? code : preferences.map(axis => axis.close ? 'X' : axis.letter).join('');
  const interpretation = preferences.map(axis => describeAxis(axis)
    + ((keyed || test.scaleScoring === 'semantic_weighted') && test.responseLevels === 3 ? `\n${describeThreeChoiceEvidence(test, answers, axis.dimension)}` : '')).join('\n\n');
  return {
    personality_type: persona.id, type_code: code,
    display_code: displayCode, questionnaire_version: test.version,
    match_percentage: Math.round(preferences.reduce((sum, axis) => sum + Math.max(axis.left_percent, axis.right_percent), 0) / 4),
    preferences, dimensions,
    radar_chart: Object.entries(dimensions).map(([dimension, value]) => ({ dimension, value })),
    interpretation: `${interpretation}\n\n以上只描述本次作答，不是心理诊断。奶蛙名字和金句属于娱乐创作，不能反向证明你的性格。`
  };
}

/** 仅陈述本次三选项分布；中间选项不当缺答，也不计入任一侧的次数。 */
function describeThreeChoiceEvidence(test: TestConfig, answers: Record<string, string>, dimension: string): string {
  const counts = [0, 0, 0];
  for (const question of test.questions.filter(item => item.options.some(option => dimension in option.scores))) {
    const option = question.options.find(item => item.id === answers[question.id])!;
    const score = option.scores[dimension];
    counts[score < 0.5 ? 0 : score > 0.5 ? 2 : 1]++;
  }
  if (test.scaleScoring === 'semantic_weighted') return `本组内容线索：偏左 ${counts[0]} 次 · 未提供方向 ${counts[1]} 次 · 偏右 ${counts[2]} 次；按题目权重汇总，不按按钮位置计分。`;
  return `本组选择：左侧 ${counts[0]} 次 · 中间 ${counts[1]} 次 · 右侧 ${counts[2]} 次。`;
}

/** 语义题按内容分值计分，校验题号、选项、维度、权重及完整作答，防止配置错误被默认值掩盖。 */
function validateSemanticResponses(test: TestConfig, answers: Record<string, string>): void {
  if (test.responseLevels !== 3) throw new Error('语义计分仅支持三个选项');
  if (!test.questions.length) throw new Error('语义题库必须配置题目');
  const questionIds = new Set<string>();
  const allowedAxes = new Set<string>(axes.map(axis => axis.id));
  for (const question of test.questions) {
    if (!question.id || questionIds.has(question.id)) throw new Error('题号为空或重复');
    questionIds.add(question.id);
    const weight = question.scoringWeight ?? 1;
    if (!Number.isFinite(weight) || weight <= 0 || weight > 4) throw new Error('语义题权重必须大于0且不超过4');
    const optionIds = new Set(question.options.map(option => option.id));
    if (question.options.length !== 3 || optionIds.size !== 3 || optionIds.has('')) throw new Error('语义题必须有三个唯一选项');
    const keys = Object.keys(question.options[0].scores).sort();
    if (!keys.length || keys.some(key => !allowedAxes.has(key))) throw new Error('语义题配置了无效维度');
    for (const option of question.options) {
      if (Object.keys(option.scores).sort().join(',') !== keys.join(',')) throw new Error('同题选项的维度必须一致');
      if (keys.some(key => !Number.isFinite(option.scores[key]) || option.scores[key] < 0 || option.scores[key] > 1)) {
        throw new Error('偏好选项强度必须位于 0～1');
      }
    }
    if (!question.options.some(option => option.id === answers[question.id])) throw new Error('请完成所有题目后查看结果');
  }
  if (Object.keys(answers).some(id => !questionIds.has(id))) throw new Error('答案包含未知题目');
}

/** 校验配置并将选项 ID 映射到原始响应；保留旧 scores 作为兼容字段并核对其方向防止两套键漂移。 */
function calculateKeyedScores(test: TestConfig, answers: Record<string, string>) {
  const levels = test.responseLevels ?? 5;
  if (levels !== 3 && levels !== 5) throw new Error('响应档数仅支持三档或五档');
  const items = test.questions.map(question => {
    const key = question.scoringKey;
    if (!key || !axes.some(axis => axis.id === key.scale)) throw new Error('题目缺少有效四维计分键');
    if (key.direction !== 1 && key.direction !== -1) throw new Error('计分方向必须为 1 或 -1');
    const ids = new Set(question.options.map(option => option.id));
    const values = question.options.map(option => option.responseValue);
    const expected = Array.from({ length: levels }, (_, index) => index + 1).join(',');
    if (ids.has('') || ids.size !== levels || values.length !== levels || values.some(value => !Number.isInteger(value)) || [...values].sort().join(',') !== expected) throw new Error(`${levels}档选项必须具有唯一 ID 和完整响应`);
    for (const option of question.options) {
      const raw = key.direction === 1 ? option.responseValue! : levels + 1 - option.responseValue!;
      if (option.scores[key.scale] !== (raw - 1) / (levels - 1) || Object.keys(option.scores).length !== 1) throw new Error('兼容分数与计分键不一致，强度必须与正反向键对应');
    }
    return { id: question.id, ...key };
  });
  if (axes.some(axis => !items.some(item => item.scale === axis.id))) throw new Error('每组偏好必须配置题目');
  if (Object.keys(answers).some(id => !items.some(item => item.id === id))) throw new Error('答案包含未知题目');
  const responses = Object.fromEntries(test.questions.map(question => {
    const option = question.options.find(item => item.id === answers[question.id]);
    if (!option) throw new Error('请完成所有题目后查看结果');
    return [question.id, option.responseValue!];
  }));
  return scoreKeyedScales(items, responses, levels);
}

/** 四维模式候选排序与主结果使用同一套偏好强度；分数是描述性贴近程度，不是概率。 */
export function rankFourAxisTypes(test: TestConfig, result: TestResult) {
  const preferences = result.preferences;
  if (!preferences) throw new Error('缺少四维结果');
  return test.personalityTypes.map(personalityType => {
    const fit = preferences.reduce((sum, axis, index) => {
      const letter = personalityType.id[index];
      if (letter !== axis.left && letter !== axis.right) throw new Error('人格类型编码与四轴不匹配');
      return sum + (letter === axis.right ? axis.right_percent : axis.left_percent);
    }, 0) / preferences.length;
    return { personalityType, percentage: Math.round(fit), fit };
  }).sort((a, b) => b.fit - a.fit || Number(b.personalityType.id === result.type_code) - Number(a.personalityType.id === result.type_code) || a.personalityType.id.localeCompare(b.personalityType.id));
}
