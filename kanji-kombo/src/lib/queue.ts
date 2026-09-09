import { COMPOUNDS } from "../data/compounds";
import type { AppState, UserCard } from "../types";
import { todayKey } from "./date";

export type QueueKind = "review" | "new";

export interface QueueSnapshot {
  /** 지금 당장 볼 수 있는 복습 카드 (마감 순) */
  dueNow: UserCard[];
  /** 오늘 안에 다시 나올 학습 단계 카드 (아직 시간이 안 됨) */
  pending: UserCard[];
  /** 오늘 남은 신규 카드 수 */
  newRemaining: number;
  /** 아직 한 번도 꺼내지 않은 숙어 수 */
  unseenTotal: number;
  reviewsDoneToday: number;
  newDoneToday: number;
  /** 오늘의 신규 목표치 (기본 목표 + 추가분) */
  newGoalToday: number;
  /** 복습 상한에 걸려 오늘은 더 안 내보내는 상태인가 */
  reviewCapped: boolean;
  next: { card: UserCard | null; compoundId: string; kind: QueueKind } | null;
  /** 지금 볼 카드가 없을 때, 다음 카드가 준비되는 시각 */
  nextReadyAt: Date | null;
}

/** 아직 학습에 투입되지 않은 숙어를 배당표 순서대로 */
export function unseenCompoundIds(state: AppState): string[] {
  return COMPOUNDS.filter((c) => !state.cards[c.id]).map((c) => c.id);
}

export function buildQueue(state: AppState, now: Date = new Date()): QueueSnapshot {
  const today = todayKey(state.settings.dayStartHour);
  const ts = now.getTime();

  const all = Object.values(state.cards);
  const due: UserCard[] = [];
  const pending: UserCard[] = [];
  for (const card of all) {
    const dueTs = new Date(card.dueAt).getTime();
    if (dueTs <= ts) due.push(card);
    else if (card.stage === "learning" || card.stage === "new") pending.push(card);
  }
  due.sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  pending.sort((a, b) => a.dueAt.localeCompare(b.dueAt));

  const todayStat = state.dayHistory[today];
  const newDoneToday = todayStat?.fromNew ?? 0;
  // 신규 카드의 첫 채점은 '복습'으로 세지 않는다
  const reviewsDoneToday = Math.max(0, (todayStat?.reviews ?? 0) - newDoneToday);

  // 상한은 '복습/성숙' 카드에만 적용한다. 학습 단계 카드까지 막으면 시작한 카드가 갇힌다.
  const reviewCapped = reviewsDoneToday >= state.settings.dailyReviewCap;
  const servable = reviewCapped
    ? due.filter((c) => c.stage === "learning" || c.stage === "new")
    : due;

  const unseen = unseenCompoundIds(state);
  const bonusToday = state.bonusNewByDay[today] ?? 0;
  const newRemaining = Math.max(0, state.settings.dailyNewGoal + bonusToday - newDoneToday);

  let next: QueueSnapshot["next"] = null;
  if (servable.length > 0) {
    next = { card: servable[0], compoundId: servable[0].compoundId, kind: "review" };
  } else if (newRemaining > 0 && unseen.length > 0) {
    next = { card: null, compoundId: unseen[0], kind: "new" };
  }

  const nextReadyAt = next === null && pending.length > 0 ? new Date(pending[0].dueAt) : null;

  return {
    dueNow: servable,
    pending,
    newRemaining: Math.min(newRemaining, unseen.length),
    unseenTotal: unseen.length,
    reviewsDoneToday,
    newDoneToday,
    newGoalToday: state.settings.dailyNewGoal + bonusToday,
    reviewCapped,
    next,
    nextReadyAt,
  };
}
