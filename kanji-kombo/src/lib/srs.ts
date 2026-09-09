import type { CardStage, Rating, UserCard } from "../types";
import { DAY, MINUTE } from "./date";

/**
 * SM-2 계열 스페이스드 리피티션 (PRD 6장).
 * Anki와 동일하게 "학습 단계(learning steps) → 졸업 → 간격 배수" 구조를 쓴다.
 */

/** 신규/재학습 카드가 거치는 단계. 분 단위. */
export const LEARNING_STEPS_MIN = [1, 10];
/** 졸업 직후 첫 복습 간격(일) */
export const GRADUATING_INTERVAL = 1;
/** "쉬움"으로 졸업할 때의 간격(일) */
export const EASY_INTERVAL = 4;
export const MIN_EASE = 1.3;
export const START_EASE = 2.5;
/** 이 간격 이상이면 '성숙(mature)' */
export const MATURE_THRESHOLD = 21;
/** 간격이 무한정 늘어나지 않도록 제한 */
export const MAX_INTERVAL = 365 * 2;

const EASE_DELTA: Record<Rating, number> = {
  again: -0.2,
  hard: -0.15,
  good: 0,
  easy: 0.15,
};

export function createCard(compoundId: string, now: Date): UserCard {
  return {
    compoundId,
    stage: "new",
    ease: START_EASE,
    interval: 0,
    step: 0,
    dueAt: now.toISOString(),
    reps: 0,
    lapses: 0,
    lastReviewedAt: null,
    introducedAt: now.toISOString(),
  };
}

function stageFor(interval: number): CardStage {
  return interval >= MATURE_THRESHOLD ? "mature" : "review";
}

function clampInterval(days: number): number {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)));
}

/** 채점 결과를 카드에 반영한 새 카드 객체를 돌려준다. (순수 함수) */
export function applyRating(card: UserCard, rating: Rating, now: Date): UserCard {
  const next: UserCard = { ...card };
  next.reps = card.reps + 1;
  next.lastReviewedAt = now.toISOString();

  const inLearning = card.stage === "new" || card.stage === "learning";

  if (inLearning) {
    if (rating === "again") {
      next.stage = "learning";
      next.step = 0;
      next.dueAt = new Date(now.getTime() + LEARNING_STEPS_MIN[0] * MINUTE).toISOString();
      return next;
    }
    if (rating === "easy") {
      // 학습 단계를 건너뛰고 바로 졸업
      next.interval = EASY_INTERVAL;
      next.stage = stageFor(next.interval);
      next.step = 0;
      next.ease = Math.max(MIN_EASE, card.ease + EASE_DELTA.easy);
      next.dueAt = new Date(now.getTime() + next.interval * DAY).toISOString();
      return next;
    }
    if (rating === "hard") {
      // 같은 단계를 한 번 더 (조금 더 짧은 간격으로)
      next.stage = "learning";
      const wait = LEARNING_STEPS_MIN[Math.min(card.step, LEARNING_STEPS_MIN.length - 1)];
      next.dueAt = new Date(now.getTime() + wait * MINUTE).toISOString();
      return next;
    }
    // good — 다음 단계로, 마지막이면 졸업
    const nextStep = card.step + 1;
    if (nextStep >= LEARNING_STEPS_MIN.length) {
      next.interval = GRADUATING_INTERVAL;
      next.stage = stageFor(next.interval);
      next.step = 0;
      next.dueAt = new Date(now.getTime() + next.interval * DAY).toISOString();
      return next;
    }
    next.stage = "learning";
    next.step = nextStep;
    next.dueAt = new Date(now.getTime() + LEARNING_STEPS_MIN[nextStep] * MINUTE).toISOString();
    return next;
  }

  // 복습 카드
  next.ease = Math.max(MIN_EASE, card.ease + EASE_DELTA[rating]);

  if (rating === "again") {
    next.lapses = card.lapses + 1;
    next.stage = "learning";
    next.step = 0;
    // 실수한 카드는 간격을 초기화하되 완전히 0으로 돌리진 않는다
    next.interval = Math.max(1, Math.round(card.interval * 0.4));
    next.dueAt = new Date(now.getTime() + LEARNING_STEPS_MIN[0] * MINUTE).toISOString();
    return next;
  }

  const base = Math.max(card.interval, 1);
  let days: number;
  if (rating === "hard") days = base * 1.2;
  else if (rating === "good") days = base * next.ease;
  else days = base * next.ease * 1.3;

  next.interval = clampInterval(Math.max(days, base + 1));
  next.stage = stageFor(next.interval);
  next.step = 0;
  next.dueAt = new Date(now.getTime() + next.interval * DAY).toISOString();
  return next;
}

/** 채점 버튼에 미리 보여줄 "다음 복습까지" 예상 시간(ms). */
export function previewIntervalMs(card: UserCard, rating: Rating, now: Date): number {
  const after = applyRating(card, rating, now);
  return new Date(after.dueAt).getTime() - now.getTime();
}

export const RATING_META: { rating: Rating; label: string; key: string; tone: string }[] = [
  { rating: "again", label: "다시", key: "1", tone: "again" },
  { rating: "hard", label: "어려움", key: "2", tone: "hard" },
  { rating: "good", label: "보통", key: "3", tone: "good" },
  { rating: "easy", label: "쉬움", key: "4", tone: "easy" },
];
