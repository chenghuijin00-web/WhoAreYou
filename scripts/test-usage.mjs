import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { onRequest, onRequestGet, onRequestPost } from '../functions/api/usage.ts';
import { usageEvents } from '../src/core/usageMetrics.ts';

const sql = new DatabaseSync(':memory:');
sql.exec(readFileSync(new URL('../migrations/0001_usage_daily.sql', import.meta.url), 'utf8'));
const db = {
  prepare(query) {
    const stmt = sql.prepare(query);
    let args = [];
    return {
      bind(...values) { args = values; return this; },
      async run() { stmt.run(...args); return { success: true }; },
      all() { return { success: true, results: stmt.all(...args) }; }
    };
  },
  async batch(statements) { return statements.map(statement => statement.all()); }
};
const token = 'a'.repeat(64); // 仅为测试夹具，线上不能使用。
const env = { USAGE_DB: db, USAGE_ADMIN_TOKEN: token };
const origin = 'https://example.test';
function post(event = 'visit', headers = {}, body) {
  return new Request(origin + '/api/usage', {
    method: 'POST', body, headers: { Origin: origin, 'X-Usage-Event': event, ...headers }
  });
}
function get(value) {
  return new Request(origin + '/api/usage', { headers: value ? { Authorization: 'Bearer ' + value } : {} });
}
assert.equal(onRequest().status, 405);
assert.equal((await onRequestPost({ request: post(), env: {} })).status, 503);
assert.equal((await onRequestGet({ request: get(token), env: { ...env, USAGE_ADMIN_TOKEN: 'weak' } })).status, 503);
assert.equal((await onRequestGet({ request: get(), env })).status, 401);
assert.equal((await onRequestGet({ request: get('b'.repeat(64)), env })).status, 401);
assert.equal((await onRequestPost({ request: post('visit', { Origin: 'https://other.test' }), env })).status, 403);
assert.equal((await onRequestPost({ request: post('unknown'), env })).status, 400);
assert.equal((await onRequestPost({ request: post('visit', { 'Content-Length': '13' }, 'not collected'), env })).status, 400);
assert.equal((await onRequestPost({ request: post('visit', { 'Sec-GPC': '1' }), env })).status, 204);
assert.equal((await onRequestPost({ request: post('visit', { DNT: '1' }), env })).status, 204);

try {
  // 上海刚跨天，历史行进入累计但不进入近 30 天；没有数据日期也必须补零。
  const systemDate = Date;
  const fixed = systemDate.parse('2026-11-17T16:00:01Z');
  globalThis.Date = class extends systemDate {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return fixed; }
  };
  try {
    sql.exec("INSERT INTO usage_daily VALUES ('2026-10-19', 'visit', 10), ('2026-11-17', 'test_start', 1)");
    for (const event of usageEvents) assert.equal((await onRequestPost({ request: post(event), env })).status, 204);
    const concurrent = await Promise.all(Array.from({ length: 12 }, () => onRequestPost({ request: post(), env })));
    assert.ok(concurrent.every(response => response.status === 204));
    const response = await onRequestGet({ request: get(token), env });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    const report = await response.json();
    assert.equal(report.days.length, 30);
    assert.deepEqual(report.days[0], {
      day: '2026-11-18', visit: 13, test_start: 1, test_finish: 1, poster_generated: 1, share_copied: 1
    });
    assert.equal(report.days[1].test_start, 1);
    assert.equal(report.days[29].day, '2026-10-20');
    assert.equal(report.days[29].visit, 0);
    assert.equal(report.totals.visit, 23);
    assert.equal(report.totals.test_start, 2);
  } finally {
    globalThis.Date = systemDate;
  }
} finally {
  sql.close();
}
assert.equal((await onRequestGet({ request: get(token), env })).status, 503);
assert.equal((await onRequestPost({ request: post(), env })).status, 503);
console.log('PASS: 5 种事件、管理员鉴权、来源校验、隐私偏好、并发累加、上海跨天归档、近 30 天与故障降级。');
