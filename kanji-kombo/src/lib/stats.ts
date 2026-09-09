import { COMPOUNDS, COMPOUNDS_BY_KANJI } from "../data/compounds";
import { KANJI } from "../data/kanji";
import type { AppState, CardStage } from "../types";
import { shiftDayKey, toDayKey, todayKey } from "./date";

export interface DayActivity {
  day: string;
  reviews: number;
  newCards: number;
}

export interface StatsSummary {
  streak: number;
  bestStreak: number;
  studiedDays: number;
  totalReviews: number;
  reviewsToday: number;
  /** 전체 채점 중 '다시'가 아닌 비율 */
  accuracy: number;
  stageCounts: Record<CardStage, number>;
  seenCompounds: number;
  totalCompounds: number;
  /** 숙어를 하나라도 학습한 한자 수 */
  kanjiTouched: number;
  /** 그 한자의 숙어를 모두 학습한 한자 수 */
  kanjiCompleted: number;
  totalKanji: number;
}

export function summarize(state: AppState, now: Date = new Date()): StatsSummary {
  const today = toDayKey(now, state.settings.dayStartHour);
  const cards = Object.values(state.cards);

  const stageCounts: Record<CardStage, number> = { new: 0, learning: 0, review: 0, mature: 0 };
  for (const c of cards) stageCounts[c.stage] += 1;

  const days = new Set(
    Object.entries(state.dayHistory)
      .filter(([, stat]) => stat.reviews > 0)
      .map(([day]) => day),
  );

  // 연속 학습일: 오늘(혹은 어제)부터 거꾸로 이어지는 날짜 수
  let streak = 0;
  let cursor: string = days.has(today) ? today : shiftDayKey(today, -1);
  if (days.has(cursor)) {
    while (days.has(cursor)) {
      streak += 1;
      cursor = shiftDayKey(cursor, -1);
    }
  }

  const sortedDays = [...days].sort();
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of sortedDays) {
    run = prev !== null && shiftDayKey(prev, 1) === d ? run + 1 : 1;
    bestStreak = Math.max(bestStreak, run);
    prev = d;
  }

  let totalReviews = 0;
  let totalAgain = 0;
  for (const stat of Object.values(state.dayHistory)) {
    totalReviews += stat.reviews;
    totalAgain += stat.again;
  }
  const accuracy = totalReviews === 0 ? 0 : 1 - totalAgain / totalReviews;

  const touched = KANJI.filter((k) =>
    (COMPOUNDS_BY_KANJI[k.id] ?? []).some((c) => state.cards[c.id]),
  ).length;
  const completed = KANJI.filter((k) => {
    const list = COMPOUNDS_BY_KANJI[k.id] ?? [];
    return list.length > 0 && list.every((c) => state.cards[c.id]);
  }).length;

  return {
    streak,
    bestStreak,
    studiedDays: days.size,
    totalReviews,
    reviewsToday: state.dayHistory[today]?.reviews ?? 0,
    accuracy,
    stageCounts,
    seenCompounds: cards.length,
    totalCompounds: COMPOUNDS.length,
    kanjiTouched: touched,
    kanjiCompleted: completed,
    totalKanji: KANJI.length,
  };
}

/** 최근 n일의 일별 활동 (오래된 날짜부터) */
export function recentActivity(state: AppState, n: number): DayActivity[] {
  const today = todayKey(state.settings.dayStartHour);
  const out: DayActivity[] = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const day = shiftDayKey(today, -i);
    const stat = state.dayHistory[day];
    out.push({ day, reviews: stat?.reviews ?? 0, newCards: stat?.fromNew ?? 0 });
  }
  return out;
}

/** 앞으로 n일간 복습 예정 카드 수 */
export function forecast(state: AppState, n: number): { day: string; count: number }[] {
  const today = todayKey(state.settings.dayStartHour);
  const counts = new Map<string, number>();
  for (const card of Object.values(state.cards)) {
    const day = dayOf(card.dueAt, state.settings.dayStartHour);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  const out: { day: string; count: number }[] = [];
  let overdue = 0;
  for (const [day, count] of counts) if (day < today) overdue += count;
  for (let i = 0; i < n; i += 1) {
    const day = shiftDayKey(today, i);
    out.push({ day, count: (counts.get(day) ?? 0) + (i === 0 ? overdue : 0) });
  }
  return out;
}

function dayOf(iso: string, dayStartHour: number): string {
  const d = new Date(iso);
  const shifted = new Date(d.getTime() - dayStartHour * 60 * 60 * 1000);
  const y = shifted.getFullYear();
  const m = String(shifted.getMonth() + 1).padStart(2, "0");
  const dd = String(shifted.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** 학년별 진행률 (지금은 1학년만 있지만 확장 대비) */
export function gradeProgress(state: AppState) {
  const grades = [...new Set(KANJI.map((k) => k.grade))].sort();
  return grades.map((grade) => {
    const list = KANJI.filter((k) => k.grade === grade);
    const touched = list.filter((k) =>
      (COMPOUNDS_BY_KANJI[k.id] ?? []).some((c) => state.cards[c.id]),
    ).length;
    return { grade, total: list.length, touched };
  });
}
