/** 학습일(day) 계산 유틸. dayStartHour 이전은 전날로 친다. */

export const MINUTE = 60 * 1000;
export const DAY = 24 * 60 * MINUTE;

export function toDayKey(date: Date, dayStartHour: number): string {
  const shifted = new Date(date.getTime() - dayStartHour * 60 * MINUTE);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const d = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(dayStartHour: number): string {
  return toDayKey(new Date(), dayStartHour);
}

/** dayKey에서 n일 전/후의 dayKey */
export function shiftDayKey(dayKey: string, days: number): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function formatDayKey(dayKey: string): string {
  const [, m, d] = dayKey.split("-");
  return `${Number(m)}월 ${Number(d)}일`;
}

/** "3일", "12시간", "8분" 처럼 다음 복습까지 남은 시간을 사람이 읽는 형태로. */
export function humanizeInterval(ms: number): string {
  if (ms < MINUTE) return "1분 미만";
  const minutes = Math.round(ms / MINUTE);
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}시간`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}일`;
  const months = Math.round((days / 365) * 12);
  if (months < 12) return `${months}개월`;
  return `${(days / 365).toFixed(1)}년`;
}
