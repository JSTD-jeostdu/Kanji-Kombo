import type { AppState, DayStat, Settings } from "../types";

const STORAGE_KEY = "kanji-kombo/state";
/** 2 — 원시 채점 로그를 일별 집계(dayHistory)로 대체 */
export const STATE_VERSION = 2;

export const DEFAULT_SETTINGS: Settings = {
  dailyNewGoal: 10,
  dailyReviewCap: 120,
  furiganaDefault: true,
  dayStartHour: 4,
  showKoreanReading: true,
};

export function emptyState(): AppState {
  return {
    version: STATE_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    cards: {},
    dayHistory: {},
    bonusNewByDay: {},
    lastStudiedDay: null,
    updatedAt: new Date(0).toISOString(),
  };
}

/** v1(원시 로그) 저장분을 일별 집계로 옮긴다. */
function migrateV1(raw: Record<string, unknown>): Record<string, DayStat> {
  const history: Record<string, DayStat> = {};
  const log = Array.isArray(raw.log) ? (raw.log as Record<string, unknown>[]) : [];
  for (const entry of log) {
    const day = typeof entry.day === "string" ? entry.day : null;
    if (!day) continue;
    const stat = (history[day] ??= { reviews: 0, fromNew: 0, again: 0 });
    stat.reviews += 1;
    if (entry.fromStage === "new") stat.fromNew += 1;
    if (entry.rating === "again") stat.again += 1;
  }
  // 로그가 잘려 나간 구간은 newIntroducedByDay 쪽 수치를 신뢰한다
  const introduced = raw.newIntroducedByDay;
  if (introduced && typeof introduced === "object") {
    for (const [day, count] of Object.entries(introduced as Record<string, number>)) {
      if (typeof count !== "number") continue;
      const stat = (history[day] ??= { reviews: 0, fromNew: 0, again: 0 });
      stat.fromNew = Math.max(stat.fromNew, count);
      stat.reviews = Math.max(stat.reviews, stat.fromNew);
    }
  }
  return history;
}

function normalizeDayHistory(value: unknown): Record<string, DayStat> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string, DayStat> = {};
  for (const [day, stat] of Object.entries(value as Record<string, unknown>)) {
    if (!stat || typeof stat !== "object") continue;
    const s = stat as Partial<DayStat>;
    out[day] = {
      reviews: Number(s.reviews) || 0,
      fromNew: Number(s.fromNew) || 0,
      again: Number(s.again) || 0,
    };
  }
  return out;
}

/** 저장된 값이 손상돼도 앱이 죽지 않도록, 모르는 필드는 기본값으로 메운다. */
export function normalize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== "object") return base;
  const data = raw as Record<string, unknown>;
  const dayHistory =
    data.dayHistory !== undefined ? normalizeDayHistory(data.dayHistory) : migrateV1(data);
  return {
    version: STATE_VERSION,
    settings: { ...base.settings, ...((data.settings as object) ?? {}) },
    cards: data.cards && typeof data.cards === "object" ? (data.cards as AppState["cards"]) : {},
    dayHistory,
    bonusNewByDay:
      data.bonusNewByDay && typeof data.bonusNewByDay === "object"
        ? (data.bonusNewByDay as Record<string, number>)
        : {},
    lastStudiedDay: (data.lastStudiedDay as string | null) ?? null,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : base.updatedAt,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    return normalize(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // 저장 실패(용량 초과·프라이빗 모드)해도 학습은 계속되게 둔다
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
}

export function exportState(state: AppState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2);
}

export function importState(json: string): AppState {
  return normalize(JSON.parse(json));
}
