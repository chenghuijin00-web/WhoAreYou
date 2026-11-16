// 题目结构
export interface Question {
  /** 语义计分的问题权重；不指定时为1，必须大于0且不超过4。 */
  scoringWeight?: number;
  /** 原创生活场景分组与短标题；旧题库未配置时不展示。 */
  scene?: string;
  title?: string;
  scoringKey?: { scale: string; direction: 1 | -1 };
  id: string;
  text: string;
  type: 'multiple_choice';
  options: Option[];
}

export interface Option {
  responseValue?: number;
  id: string;
  text: string;
  scores: Record<string, number>;
  evidence?: OptionEvidence;
}

export interface OptionEvidence {
  supports?: EvidenceRef[];
  conflicts?: EvidenceRef[];
}

export interface EvidenceRef {
  type: string;
  weight?: number;
  reason?: string;
}

// 维度结构
export interface Dimension {
  id: string;
  name: string;
  description: string;
  min_label: string;
  max_label: string;
}

// 人格类型结构
export interface PersonalityType {
  id: string;
  name: string;
  description: string;
  meme: string;
  /** 可选的娱乐短评池；只影响展示，不影响人格分数。 */
  memeVariants?: string[];
  template: Record<string, number>;
  constraints?: DimensionConstraint[];
  tags?: string[];
}

export interface DimensionConstraint {
  dimension: string;
  min?: number;
  max?: number;
  weight?: number;
  hard?: boolean;
  description?: string;
}

// 测评结果结构
export interface TestResult {
  /** 本次完成时选定的短评，页面/分享/海报复用，不在重渲染时重新抽取。 */
  display_meme?: string;
  type_code?: string;
  display_code?: string;
  questionnaire_version?: string;
  preferences?: PreferenceScore[];
  personality_type: string;
  match_percentage: number;
  dimensions: Record<string, number>;
  radar_chart: RadarChartData[];
  interpretation: string;
}

export interface PreferenceScore {
  scoring_method?: 'semantic_weighted';
  weight_total?: number;
  /** 娱乐模式记录分差、情境题决胜或默认赠送；不修改实际票数。 */
  resolution?: 'majority' | 'tie_break' | 'fallback';
  tie_break_question_id?: string;
  raw_total?: number;
  raw_minimum?: number;
  raw_maximum?: number;
  item_count?: number;
  dimension: string;
  left: string;
  right: string;
  left_label: string;
  right_label: string;
  left_percent: number;
  right_percent: number;
  letter: string;
  close: boolean;
}

export interface RadarChartData {
  dimension: string;
  value: number;
}

// 测评接口
export interface TestInterface {
  startTest(testId: string): void;
  submitAnswer(questionId: string, optionId: string): void;
  getResult(): TestResult;
  resetTest(): void;
}

// 扩展接口
export interface ExtensionInterface {
  registerDimension(dimension: Dimension): void;
  registerPersonalityType(personalityType: PersonalityType): void;
  registerTest(test: TestConfig): void;
}

// 测评配置
export interface TestConfig {
  /** 默认保持旧版保守展示；娱乐模式始终输出完整四字母皮肤。 */
  typeResolution?: 'entertainment';
  scoringMode?: 'four_axis';
  scaleScoring?: 'ipip_sum' | 'semantic_weighted';
  /** 响应档数；旧配置默认五档。语义模式设3仅表示选项数量，不隐含位置分值。 */
  responseLevels?: 3 | 5;
  version?: string;
  id: string;
  name: string;
  description: string;
  questions: Question[];
  dimensions: Dimension[];
  personalityTypes: PersonalityType[];
  dimensionWeights?: Record<string, number>;
  maxScorePerDimension?: number;
  acceptanceCases?: AcceptanceCase[];
  icon?: string;
  imageUrl?: string;
}

export interface AcceptanceCase {
  id: string;
  label: string;
  expectedType: string;
  answers: Record<string, string>;
  description?: string;
}
