<template>
  <main class="usage">
    <RouterLink to="/">← 返回首页</RouterLink>
    <h1>奶蛙使用统计</h1>
    <p>仅管理员可查询。按北京时间统计操作次数，不代表独立用户数。</p>
    <form class="access" @submit.prevent="loadReport">
      <label for="usage-key">管理员令牌</label>
      <div>
        <input id="usage-key" v-model.trim="token" type="password" autocomplete="off"
          autocapitalize="none" :spellcheck="false" maxlength="64" required />
        <button type="submit" :disabled="loading">{{ loading ? '查询中…' : '查看统计' }}</button>
      </div>
    </form>
    <p v-if="error" role="alert">{{ error }}</p>
    <template v-if="report">
      <h2>累计</h2>
      <dl class="totals">
        <div v-for="metric in metrics" :key="metric.key">
          <dt>{{ metric.label }}</dt><dd>{{ number.format(report.totals[metric.key]) }}</dd>
        </div>
        <div><dt>答题完成率</dt><dd>{{ rate(report.totals) }}</dd></div>
      </dl>
      <h2>最近 30 天</h2>
      <p>完成率＝同期完成次数 ÷ 开始次数。跨日完成或事件漏报时，单日比例可能超过 100%。</p>
      <div class="table-scroll" tabindex="0" role="region" aria-label="最近 30 天详细统计">
        <table>
          <thead><tr><th scope="col">日期</th><th v-for="metric in metrics" :key="metric.key" scope="col">{{ metric.label }}</th><th scope="col">完成率</th></tr></thead>
          <tbody>
            <tr v-for="day in report.days" :key="day.day">
              <th scope="row">{{ day.day }}</th>
              <td v-for="metric in metrics" :key="metric.key">{{ number.format(day[metric.key]) }}</td>
              <td>{{ rate(day) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </main>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { usageEvents, type UsageCounts, type UsageReport } from '../core/usageMetrics';

const labels: Record<keyof UsageCounts, string> = {
  visit: '访问', test_start: '开始答题', test_finish: '完成答题',
  poster_generated: '生成海报', share_copied: '复制分享'
};
const metrics = usageEvents.map(key => ({ key, label: labels[key] }));
const number = new Intl.NumberFormat('zh-CN');
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', maximumFractionDigits: 1 });
const token = ref('');
const report = ref<UsageReport | null>(null);
const error = ref('');
const loading = ref(false);

function rate(counts: UsageCounts) {
  return counts.test_start ? percent.format(counts.test_finish / counts.test_start) : '—';
}

/** 令牌仅放在本次请求的认证头，不写入链接、Cookie 或本地存储。 */
async function loadReport() {
  if (loading.value) return;
  report.value = null;
  error.value = '';
  if (import.meta.env.BASE_URL !== '/') {
    token.value = '';
    error.value = '请在 Cloudflare 站点查询使用统计。';
    return;
  }
  if (!/^[0-9a-f]{64}$/.test(token.value)) {
    error.value = '请输入有效的管理员令牌。';
    return;
  }
  loading.value = true;
  try {
    const response = await fetch('/api/usage', {
      headers: { Authorization: `Bearer ${token.value}` }, cache: 'no-store',
      credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(8000)
    });
    if (response.status === 401) error.value = '令牌不正确。';
    else if (!response.ok || !response.headers.get('Content-Type')?.includes('application/json')) {
      error.value = '统计服务暂不可用，请确认部署配置后再试。';
    } else report.value = await response.json();
  } catch {
    error.value = '暂时无法查询，请稍后重试。';
  } finally {
    token.value = '';
    loading.value = false;
  }
}
</script>

<style scoped>
.usage { width: min(100%, 65rem); margin: auto; padding: 1.5rem 1rem 3rem; color: #433b24; }
.usage h1, .usage h2 { margin: 1rem 0 .5rem; }
.usage a { color: #6e5519; }
.access { margin-block: 1rem; }
.access div { display: flex; flex-wrap: wrap; gap: .5rem; margin-top: .25rem; }
.access input, .access button { min-height: 44px; border: 1px solid #bd9f56; border-radius: .55rem; padding: .5rem .75rem; font: inherit; }
.access input { width: min(100%, 20rem); }
.access button { background: #f4df89; color: #433b24; cursor: pointer; }
.totals { display: grid; grid-template-columns: repeat(auto-fit, minmax(8.5rem, 1fr)); gap: .6rem; }
.totals div { padding: .65rem 1rem; border-radius: .8rem; background: #faf0c9; }
.totals dd { font-size: 1.4rem; font-weight: 700; overflow-wrap: anywhere; }
.table-scroll { margin-top: .65rem; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; white-space: nowrap; }
th, td { padding: .5rem; border-bottom: 1px solid #e3d6ab; text-align: right; }
th:first-child { text-align: left; }
</style>
