export interface BarrageEntry {
  Name: string;
  type_id: 1 | 2;
  amount: number;
}

/** 只接受有界的演示配置；金额为整数元，不读取或表示真实支付记录。 */
export function normalizeBarrage(config: unknown): BarrageEntry[] {
  if (!config || typeof config !== 'object') return [];
  const value = config as { enabled?: unknown; entries?: unknown };
  if (value.enabled !== true || !Array.isArray(value.entries)) return [];
  return value.entries.slice(0, 60).flatMap(item => {
    if (!item || typeof item !== 'object') return [];
    const { Name, type_id, amount } = item;
    if (typeof Name !== 'string' || !Name.trim() || Array.from(Name.trim()).length > 24) return [];
    if ((type_id !== 1 && type_id !== 2) || !Number.isSafeInteger(amount) || amount < 1 || amount > 9999) return [];
    return [{ Name: Name.trim(), type_id, amount } as BarrageEntry];
  });
}

/** 多方向错峰飘入同一消散点；最多12个节点按3.36秒周期循环，不增加计时器或影响五秒解锁。 */
export function createBarrageFrames(entries: BarrageEntry[], offset = 0) {
  if (!entries.length) return [];
  const start = Number.isSafeInteger(offset) ? ((offset % entries.length) + entries.length) % entries.length : 0;
  const origins = [[-28, -35], [28, 30], [30, -25], [-26, 32], [-4, -42], [5, 42]];
  return Array.from({ length: Math.min(entries.length, 12) }, (_, index) => {
    const entry = entries[(start + index) % entries.length];
    const [fromX, fromY] = origins[index % origins.length];
    return { ...entry, key: index, fromX, fromY, delay: index * 260,
      duration: 2100, cycle: 3360, text: `${entry.Name} ${entry.type_id === 1 ? `打赏${entry.amount}元` : `踩了${entry.amount}脚`}` };
  });
}
