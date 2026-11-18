import { usageEvents, type UsageCounts, type UsageReport } from '../../src/core/usageMetrics.ts';

interface UsageRow { day?: string; event: keyof UsageCounts; total: number }
interface Statement {
  bind(...values: string[]): Statement;
  run(): Promise<{ success: boolean }>;
}
interface UsageDatabase {
  prepare(sql: string): Statement;
  batch(statements: Statement[]): Promise<{ success: boolean; results: UsageRow[] }[]>;
}
interface UsageContext {
  request: Request;
  env: { USAGE_DB?: UsageDatabase; USAGE_ADMIN_TOKEN?: string };
}

const daysShown = 30;
const dayMs = 86_400_000;
const shanghaiDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai' });
const noCache = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
const tokenPattern = /^[0-9a-f]{64}$/;

function status(code: number) {
  return new Response(null, { status: code, headers: noCache });
}

function authorized(request: Request, secret: string) {
  const candidate = request.headers.get('Authorization')?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
  if (!candidate) return false;
  // 固定长度比较，不在第一处错误字符时退出。令牌应为随机生成的 32 字节十六进制。
  let mismatch = 0;
  for (let i = 0; i < secret.length; i++) mismatch |= candidate.charCodeAt(i) ^ secret.charCodeAt(i);
  return mismatch === 0;
}

function emptyCounts(): UsageCounts {
  return { visit: 0, test_start: 0, test_finish: 0, poster_generated: 0, share_copied: 0 };
}

/** 记录一个已知动作，使用单条原子累加，避免并发覆盖当天计数。 */
export async function onRequestPost({ request, env }: UsageContext) {
  const event = request.headers.get('X-Usage-Event');
  if (request.headers.get('Origin') !== new URL(request.url).origin) return status(403);
  const bodyLength = request.headers.get('Content-Length');
  // Workerd 可能把无内容 POST 也表示为流；只校验传输头，不读取或存储正文。
  if (!event || !usageEvents.some(value => value === event) ||
      (bodyLength !== null && bodyLength !== '0') || request.headers.has('Transfer-Encoding')) return status(400);
  if (request.headers.get('Sec-GPC') === '1' || request.headers.get('DNT') === '1') return status(204);
  if (!env.USAGE_DB || !tokenPattern.test(env.USAGE_ADMIN_TOKEN ?? '')) return status(503);
  try {
    const result = await env.USAGE_DB.prepare(
      'INSERT INTO usage_daily (day, event, total) VALUES (?, ?, 1) ON CONFLICT (day, event) DO UPDATE SET total = total + 1'
    ).bind(shanghaiDay.format(new Date()), event).run();
    return status(result.success ? 204 : 503);
  } catch {
    return status(503);
  }
}

/** 验证管理员令牌，返回全量累计和最近 30 个上海自然日的数据，缺少记录的天补零。 */
export async function onRequestGet({ request, env }: UsageContext) {
  const { USAGE_DB: db, USAGE_ADMIN_TOKEN: secret } = env;
  if (!secret || !tokenPattern.test(secret)) return status(503);
  if (!authorized(request, secret)) return status(401);
  if (!db) return status(503);
  const now = Date.now();
  const days = Array.from({ length: daysShown }, (_, index) => ({
    day: shanghaiDay.format(new Date(now - index * dayMs)),
    ...emptyCounts()
  }));
  const byDay = new Map(days.map(row => [row.day, row]));
  try {
    const [totals, recent] = await db.batch([
      db.prepare('SELECT event, SUM(total) AS total FROM usage_daily GROUP BY event'),
      db.prepare('SELECT day, event, total FROM usage_daily WHERE day >= ? AND day <= ?')
        .bind(days[days.length - 1].day, days[0].day)
    ]);
    if (!totals.success || !recent.success) return status(503);
    const report: UsageReport = { totals: emptyCounts(), days };
    for (const row of totals.results) report.totals[row.event] = row.total;
    for (const row of recent.results) {
      const target = row.day ? byDay.get(row.day) : undefined;
      if (target) target[row.event] = row.total;
    }
    return Response.json(report, { headers: noCache });
  } catch {
    return status(503);
  }
}

export function onRequest() {
  return new Response(null, { status: 405, headers: { ...noCache, Allow: 'GET, POST' } });
}
