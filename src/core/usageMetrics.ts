export const usageEvents = ['visit', 'test_start', 'test_finish', 'poster_generated', 'share_copied'] as const;
export type UsageEvent = typeof usageEvents[number];
export interface UsageCounts {
  visit: number;
  test_start: number;
  test_finish: number;
  poster_generated: number;
  share_copied: number;
}
export interface UsageDay extends UsageCounts { day: string }
export interface UsageReport { totals: UsageCounts; days: UsageDay[] }
