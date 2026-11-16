import { naifrogTest } from '../../src/instance/naifrogTest.ts';
import scenes from './naifrog-scenes-v8.json' with { type: 'json' };

// 冻结旧版三档问卷，只用于兼容回归；当前活跃语义题库另由test-semantic覆盖。
export const legacyTest = {
  ...naifrogTest, scaleScoring: 'ipip_sum', version: scenes.version,
  questions: scenes.questions.map(row => ({
    id: row.id, text: row.text, scene: row.scene, title: row.title, type: 'multiple_choice',
    scoringKey: { scale: row.axis, direction: row.positive === 'b' ? 1 : -1 },
    options: [
      { id: 'a', responseValue: 1, text: row.a, scores: { [row.axis]: row.positive === 'a' ? 1 : 0 } },
      { id: 'neutral', responseValue: 2, text: row.neutral, scores: { [row.axis]: 0.5 } },
      { id: 'b', responseValue: 3, text: row.b, scores: { [row.axis]: row.positive === 'b' ? 1 : 0 } }
    ]
  }))
};
