/**
 * 独立实现 IPIP 公开计分规则，不复制第三方项目代码。
 * https://ipip.ori.org/newScoringInstructions.htm
 * 原五档正向记 response，反向记 6-response；三档为本站适配，反向记 4-response。
 * 本模块只提供计分方法，不代表接入了经过验证的 IPIP 量表。
 */
export interface KeyedItem {
  id: string;
  scale: string;
  direction: 1 | -1;
}

export interface KeyedScaleScore {
  scale: string;
  itemCount: number;
  rawTotal: number;
  minimum: number;
  maximum: number;
  normalized: number;
}

/** 校验题目键与所有响应；不补齐缺答，不把未经历或缺失值当中立。 */
export function validateKeyedResponses(items: KeyedItem[], responses: Record<string, number>, levels: 3 | 5 = 5): void {
  if (levels !== 3 && levels !== 5) throw new Error('响应档数仅支持三档或五档');
  if (!items.length) throw new Error('量表必须配置题目');
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id || !item.scale || ids.has(item.id)) throw new Error('计分键存在空值或重复题目');
    if (item.direction !== 1 && item.direction !== -1) throw new Error('计分方向必须为 1 或 -1');
    ids.add(item.id);
    if (!Object.hasOwn(responses, item.id)) throw new Error('请完成所有题目后查看结果');
    const response = responses[item.id];
    if (!Number.isInteger(response) || response < 1 || response > levels) throw new Error(`响应必须为 1～${levels} 的整数`);
  }
  if (Object.keys(responses).some(id => !ids.has(id))) throw new Error('响应包含未知题目');
}

/** 按计分键独立汇总各量表；归一化仅供站内展示，不是常模百分位或准确率。 */
export function scoreKeyedScales(items: KeyedItem[], responses: Record<string, number>, levels: 3 | 5 = 5): KeyedScaleScore[] {
  validateKeyedResponses(items, responses, levels);
  const totals = new Map<string, { itemCount: number; rawTotal: number }>();
  for (const item of items) {
    const total = totals.get(item.scale) || { itemCount: 0, rawTotal: 0 };
    total.itemCount++;
    total.rawTotal += item.direction === 1 ? responses[item.id] : levels + 1 - responses[item.id];
    totals.set(item.scale, total);
  }
  return [...totals].map(([scale, total]) => ({
    scale, ...total,
    minimum: total.itemCount,
    maximum: total.itemCount * levels,
    normalized: (total.rawTotal - total.itemCount) / (total.itemCount * (levels - 1))
  }));
}
