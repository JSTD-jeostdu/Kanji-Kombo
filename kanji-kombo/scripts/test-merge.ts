/**
 * 기기 간 병합 규칙 검사. `npm run test:merge`
 *
 * 병합이 잘못되면 학습 기록이 조용히 사라진다. 두 기기를 실제로 띄워 확인하기는
 * 번거로우니, 자주 나오는 시나리오만이라도 여기서 붙잡아 둔다.
 */
import { mergeStates, stableStringify } from "../src/sync/merge";
import { emptyState } from "../src/store/persist";
import type { AppState, UserCard } from "../src/types";

let failures = 0;

function check(label: string, condition: boolean) {
  if (condition) {
    console.log(`  통과  ${label}`);
  } else {
    failures += 1;
    console.error(`  실패  ${label}`);
  }
}

function card(id: string, lastReviewedAt: string, reps: number, interval: number): UserCard {
  return {
    compoundId: id,
    stage: "review",
    ease: 2.5,
    interval,
    step: 0,
    dueAt: "2026-09-20T00:00:00.000Z",
    reps,
    lapses: 0,
    lastReviewedAt,
    introducedAt: "2026-09-01T00:00:00.000Z",
  };
}

function state(patch: Partial<AppState>): AppState {
  return { ...emptyState(), ...patch };
}

// 1) 한쪽에만 있는 카드는 사라지지 않는다
{
  const local = state({ cards: { 毎日: card("毎日", "2026-09-08T01:00:00.000Z", 3, 5) } });
  const remote = state({ cards: { 学校: card("学校", "2026-09-08T02:00:00.000Z", 1, 1) } });
  const merged = mergeStates(local, remote);
  check(
    "양쪽의 서로 다른 카드가 모두 남는다",
    Object.keys(merged.cards).length === 2 &&
      Boolean(merged.cards["毎日"]) &&
      Boolean(merged.cards["学校"]),
  );
}

// 2) 같은 카드는 더 최근에 채점한 쪽이 이긴다
{
  const older = state({ cards: { 毎日: card("毎日", "2026-09-08T01:00:00.000Z", 3, 5) } });
  const newer = state({ cards: { 毎日: card("毎日", "2026-09-08T09:00:00.000Z", 4, 12) } });
  check("원격이 더 최근이면 원격이 이긴다", mergeStates(older, newer).cards["毎日"].interval === 12);
  check("로컬이 더 최근이면 로컬이 이긴다", mergeStates(newer, older).cards["毎日"].interval === 12);
}

// 3) 일별 집계는 최댓값 — 동기화된 값이 두 배로 부풀지 않는다
{
  const a = state({ dayHistory: { "2026-09-08": { reviews: 12, fromNew: 4, again: 2 } } });
  const b = state({ dayHistory: { "2026-09-08": { reviews: 12, fromNew: 4, again: 2 } } });
  const merged = mergeStates(a, b);
  check("같은 날 같은 값은 그대로", merged.dayHistory["2026-09-08"].reviews === 12);

  const c = state({ dayHistory: { "2026-09-08": { reviews: 20, fromNew: 4, again: 3 } } });
  check("갈라진 값은 큰 쪽", mergeStates(a, c).dayHistory["2026-09-08"].reviews === 20);
}

// 4) 설정은 updatedAt이 최근인 쪽 통째로
{
  const local = state({
    settings: { ...emptyState().settings, dailyNewGoal: 10 },
    updatedAt: "2026-09-08T01:00:00.000Z",
  });
  const remote = state({
    settings: { ...emptyState().settings, dailyNewGoal: 25 },
    updatedAt: "2026-09-08T05:00:00.000Z",
  });
  check("나중에 바꾼 설정이 이긴다", mergeStates(local, remote).settings.dailyNewGoal === 25);
  check("반대 방향도 같다", mergeStates(remote, local).settings.dailyNewGoal === 25);
}

// 5) 순서를 바꿔도 결과가 같아야 한다 (양쪽 기기가 서로 다른 결론에 도달하면 안 된다)
{
  const local = state({
    cards: { 毎日: card("毎日", "2026-09-08T01:00:00.000Z", 3, 5) },
    dayHistory: { "2026-09-07": { reviews: 8, fromNew: 3, again: 1 } },
    updatedAt: "2026-09-08T01:00:00.000Z",
  });
  const remote = state({
    cards: {
      毎日: card("毎日", "2026-09-08T09:00:00.000Z", 4, 12),
      学校: card("学校", "2026-09-08T08:00:00.000Z", 1, 1),
    },
    dayHistory: { "2026-09-08": { reviews: 5, fromNew: 5, again: 0 } },
    updatedAt: "2026-09-08T09:00:00.000Z",
  });
  const ab = JSON.stringify(mergeStates(local, remote));
  const ba = JSON.stringify(mergeStates(remote, local));
  check("직렬화도 키 순서에 흔들리지 않는다", stableStringify({ a: 1, b: 2 }) === stableStringify({ b: 2, a: 1 }));
  check("병합 순서와 무관하게 같은 결과", ab === ba);
}

console.log("");
if (failures > 0) {
  console.error(`실패 ${failures}건`);
  process.exit(1);
}
console.log("병합 규칙 이상 없음");
