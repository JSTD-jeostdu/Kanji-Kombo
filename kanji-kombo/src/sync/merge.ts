import { STATE_VERSION } from "../store/persist";
import type { AppState, DayStat, UserCard } from "../types";

/**
 * 두 기기의 학습 기록을 합친다.
 *
 * 기기 간 충돌은 "문서 통째로 나중 것이 이김"으로 처리하면 오프라인에서 쌓인 학습이
 * 통째로 날아간다. 그래서 카드별·날짜별로 잘게 병합한다.
 */

/**
 * 키 순서에 흔들리지 않는 직렬화.
 *
 * 병합 결과의 키 순서는 어느 쪽을 먼저 넣었느냐에 따라 달라진다. 그대로 두면
 * 내용이 같은데도 "달라졌다"고 판정해 불필요한 렌더·쓰기가 반복된다.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
}

/** 병합 결과를 키 순서까지 결정적으로 만든다. */
function sortRecord<T>(record: Record<string, T>): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
}

/** 카드의 최신성 기준 — 마지막 채점 시각(없으면 도입 시각) */
function cardTime(card: UserCard): number {
  const iso = card.lastReviewedAt ?? card.introducedAt;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : t;
}

function mergeCards(
  a: Record<string, UserCard>,
  b: Record<string, UserCard>,
): Record<string, UserCard> {
  const out: Record<string, UserCard> = { ...a };
  for (const [id, incoming] of Object.entries(b)) {
    const current = out[id];
    if (!current) {
      out[id] = incoming;
      continue;
    }
    const dt = cardTime(incoming) - cardTime(current);
    // 시각이 같으면 더 많이 채점된 쪽을 남긴다
    if (dt > 0 || (dt === 0 && incoming.reps > current.reps)) out[id] = incoming;
  }
  return sortRecord(out);
}

/**
 * 일별 집계는 항목별 최댓값을 취한다.
 *
 * 동기화된 상태라면 양쪽 값이 같으므로 최댓값이 곧 정답이고, 오프라인으로 갈라진
 * 경우에도 합계처럼 이중으로 부풀지 않는다.
 */
function mergeDayHistory(
  a: Record<string, DayStat>,
  b: Record<string, DayStat>,
): Record<string, DayStat> {
  const out: Record<string, DayStat> = { ...a };
  for (const [day, incoming] of Object.entries(b)) {
    const current = out[day];
    out[day] = current
      ? {
          reviews: Math.max(current.reviews, incoming.reviews),
          fromNew: Math.max(current.fromNew, incoming.fromNew),
          again: Math.max(current.again, incoming.again),
        }
      : incoming;
  }
  return sortRecord(out);
}

function mergeCounts(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    out[key] = Math.max(out[key] ?? 0, value);
  }
  return sortRecord(out);
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a >= b ? a : b;
}

export function mergeStates(local: AppState, remote: AppState): AppState {
  // 설정은 쪼갤 수 없으니 통째로 나중에 바뀐 쪽을 쓴다
  const newerSettings = remote.updatedAt > local.updatedAt ? remote.settings : local.settings;
  return {
    version: STATE_VERSION,
    settings: newerSettings,
    cards: mergeCards(local.cards, remote.cards),
    dayHistory: mergeDayHistory(local.dayHistory, remote.dayHistory),
    bonusNewByDay: mergeCounts(local.bonusNewByDay, remote.bonusNewByDay),
    lastStudiedDay: laterOf(local.lastStudiedDay, remote.lastStudiedDay),
    updatedAt: laterOf(local.updatedAt, remote.updatedAt) ?? local.updatedAt,
  };
}

/** 병합 결과가 실제로 달라졌는지 — 불필요한 렌더·쓰기를 막는다. */
export function sameState(a: AppState, b: AppState): boolean {
  return stableStringify(a) === stableStringify(b);
}
