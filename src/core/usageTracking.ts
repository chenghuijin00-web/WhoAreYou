import type { UsageEvent } from './usageMetrics';

/** 只发送动作类型；不发送来源、账号、答案，也不阻塞用户操作或重试计数。 */
export function trackUsage(event: UsageEvent): void {
  if (import.meta.env?.BASE_URL !== '/' || typeof window === 'undefined') return;
  const browser = window.navigator as Navigator & { globalPrivacyControl?: boolean };
  if (browser.globalPrivacyControl || browser.doNotTrack === '1') return;
  void fetch('/api/usage', {
    method: 'POST',
    headers: { 'X-Usage-Event': event },
    credentials: 'omit',
    redirect: 'error',
    referrerPolicy: 'origin',
    keepalive: true
  }).catch(() => { /* 统计是尽力上报，网络失败不影响主要流程。 */ });
}
