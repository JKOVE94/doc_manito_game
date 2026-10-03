export interface AwayPeriod {
  startedAt: number; // ms
  endedAt: number | null; // ms, null = 아직 자리비움 중
}

/**
 * 자리비움 유예가 반영된 개인 마감 (시계 멈춤 방식).
 * 미션이 열린 뒤, 아직 (연장된) 마감 전에 시작된 자리비움 시간만큼 마감을 미룬다.
 * 예) 1:50 에 자리비움, 2:00 마감, 3:00 복귀 → 남은 10분이 보존되어 3:10 + 버퍼.
 * 유예가 생기면 복귀 버퍼(bufferMs)를 한 번 더한다.
 */
export function personalDeadline(
  openedAt: number,
  deadline: number,
  periods: readonly AwayPeriod[],
  now: number,
  bufferMs: number,
): { deadline: number; graceMs: number } {
  let d = deadline;
  const sorted = [...periods].sort((a, b) => a.startedAt - b.startedAt);
  for (const p of sorted) {
    const start = Math.max(p.startedAt, openedAt);
    const end = p.endedAt ?? now;
    if (p.startedAt >= d || end <= start) continue;
    d += end - start;
  }
  const grace = d - deadline;
  return grace > 0 ? { deadline: d + bufferMs, graceMs: grace + bufferMs } : { deadline, graceMs: 0 };
}
