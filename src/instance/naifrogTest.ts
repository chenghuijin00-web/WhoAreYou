import type { TestConfig } from '../protocol/types';
import bank from './naifrog-bank.json' with { type: 'json' };
import scenes from './naifrog-scenes.json' with { type: 'json' };
import appearances from './naifrog-appearance.json' with { type: 'json' };
import abstractReviews from './naifrog-abstract-reviews.json' with { type: 'json' };

// 展示配置与计分编码分离；收集表中的取名不改变内部类型 ID。
const appearanceNames = new Map(appearances.map(item => [item.code, item.name]));

// 延续旧主题 ID，保持既有入口兼容；旧程序员题库保留在原文件，不再发布。
export const naifrogTest: TestConfig = {
  id: 'programmer',
  name: '奶蛙人格测试',
  description: '12 道抽象生活情境题 · 朋友、恋人和日常，看看你是哪只奶蛙。',
  imageUrl: '/PMD/images/frog-curious.png',
  scoringMode: 'four_axis',
  typeResolution: 'entertainment',
  scaleScoring: 'semantic_weighted',
  responseLevels: 3,
  version: scenes.version,
  dimensions: bank.axes.map(axis => ({
    id: axis.id, name: axis.name, description: `${axis.leftLabel} / ${axis.rightLabel}`,
    min_label: axis.leftLabel, max_label: axis.rightLabel
  })),
  questions: scenes.questions.map(row => ({
    id: row.id, text: row.text, scene: row.scene, title: row.title, type: 'multiple_choice',
    // 按内容配置分值，保持用户的按钮顺序；neutral只是沿用的选项ID，不表示中立分。
    scoringWeight: row.weight,
    options: [
      { id: 'a', text: row.a, scores: { [row.axis]: row.scores[0] } },
      { id: 'neutral', text: row.neutral, scores: { [row.axis]: row.scores[1] } },
      { id: 'b', text: row.b, scores: { [row.axis]: row.scores[2] } }
    ]
  })),
  personalityTypes: bank.personas.map((persona, index) => ({
    // 短评是所有角色共享的审核文案池，不代表该人格；默认句仅用于兼容没有display_meme的旧结果。
    id: persona.code, name: appearanceNames.get(persona.code) ?? persona.name, meme: abstractReviews[index % abstractReviews.length],
    memeVariants: abstractReviews,
    description: `${persona.description}\n\n亲近的人面前：${persona.relationship}\n\n你的顺手技能：${persona.strength}\n\n偶尔会卡住：${persona.pitfall}\n\n给这只蛙的小建议：${persona.advice}`,
    template: {}, tags: persona.tags
  }))
};
