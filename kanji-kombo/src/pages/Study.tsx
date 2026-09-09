import { useCallback, useEffect, useState } from "react";
import { RatingBar } from "../components/RatingBar";
import { Sheet } from "../components/Sheet";
import { TodayQueue } from "../components/TodayQueue";
import { StudyCard } from "../components/StudyCard";
import { ProgressBar } from "../components/ui";
import { COMPOUND_BY_ID } from "../data/compounds";
import { humanizeInterval } from "../lib/date";
import { useApp } from "../store/appContext";
import type { Rating } from "../types";

export function Study() {
  const { state, queue, now, answer, undoLast, canUndo, addBonusNew } = useApp();
  // 어떤 카드를 뒤집었는지 id로 들고 있으면, 카드가 바뀔 때 저절로 앞면으로 돌아온다
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [queueOpen, setQueueOpen] = useState(false);
  const [showFurigana, setShowFurigana] = useState(state.settings.furiganaDefault);

  const currentId = queue.next?.compoundId ?? null;
  const compound = currentId ? COMPOUND_BY_ID[currentId] : null;
  const revealed = currentId !== null && revealedId === currentId;
  const reveal = useCallback(() => setRevealedId(currentId), [currentId]);

  const rate = useCallback(
    (rating: Rating) => {
      if (!currentId) return;
      answer(currentId, rating);
      setRevealedId(null);
    },
    [answer, currentId],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

      if (e.key === "f" || e.key === "F") {
        setShowFurigana((v) => !v);
        return;
      }
      if (e.key === "u" || e.key === "U") {
        if (canUndo) undoLast();
        return;
      }
      if (!compound) return;
      const isSpace = e.key === " " || e.code === "Space";
      if (!revealed) {
        if (isSpace || e.key === "Enter") {
          e.preventDefault();
          reveal();
        }
        return;
      }
      const map: Record<string, Rating> = { "1": "again", "2": "hard", "3": "good", "4": "easy" };
      if (e.key in map) {
        e.preventDefault();
        rate(map[e.key]);
      } else if (isSpace) {
        e.preventDefault();
        rate("good");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compound, revealed, rate, reveal, canUndo, undoLast]);

  const dueCount = queue.dueNow.length;
  const remainingToday = dueCount + queue.newRemaining;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-4 px-4 pt-4 pb-6">
      <header className="rounded-2xl bg-card px-4 py-3 shadow-[0_1px_2px_rgba(18,21,28,0.06)] ring-1 ring-ink-900/5">
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          className="flex w-full items-center justify-between gap-3 text-[12px] font-semibold"
        >
          <span className="text-ink-500">오늘의 복습 큐</span>
          <span className="flex items-center gap-1 tabular-nums text-ink-400">
            복습 {dueCount} · 신규 {queue.newRemaining}
            <span aria-hidden className="text-ink-300">›</span>
          </span>
        </button>
        <div className="mt-2">
          <ProgressBar
            value={queue.newDoneToday}
            max={Math.max(queue.newGoalToday, 1)}
            tone="bg-vermilion-500"
          />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[11px] text-ink-400">
          <span className="tabular-nums">
            신규 {queue.newDoneToday} / {queue.newGoalToday}장
          </span>
          <span className="tabular-nums">오늘 채점 {queue.reviewsDoneToday + queue.newDoneToday}회</span>
        </div>
      </header>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setShowFurigana((v) => !v)}
          className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition ${
            showFurigana
              ? "bg-ink-900 text-white ring-ink-900"
              : "bg-card text-ink-500 ring-ink-900/10"
          }`}
        >
          후리가나 {showFurigana ? "ON" : "OFF"}
        </button>
        <button
          type="button"
          disabled={!canUndo}
          onClick={undoLast}
          className="rounded-full bg-card px-3 py-1.5 text-[12px] font-semibold text-ink-500 ring-1 ring-ink-900/10 transition disabled:opacity-35"
        >
          실행 취소
        </button>
        <span className="ml-auto text-[11px] text-ink-300">Space · 1~4 · F · U</span>
      </div>

      {queueOpen && (
        <Sheet title="오늘의 복습 큐" onClose={() => setQueueOpen(false)}>
          <TodayQueue />
        </Sheet>
      )}

      {compound ? (
        <>
          <StudyCard
            key={compound.id}
            compound={compound}
            card={queue.next?.card ?? null}
            revealed={revealed}
            showFurigana={showFurigana}
            showKoreanReading={state.settings.showKoreanReading}
            onReveal={reveal}
          />
          <div className="sticky bottom-2 mt-auto pt-2">
            {revealed ? (
              <div className="kc-pop rounded-3xl bg-card/95 p-2 shadow-[0_2px_16px_rgba(18,21,28,0.1)] ring-1 ring-ink-900/5 backdrop-blur">
                <RatingBar
                  compoundId={compound.id}
                  card={queue.next?.card ?? null}
                  now={now}
                  onRate={rate}
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={reveal}
                className="w-full rounded-3xl bg-ink-900 py-4 text-[15px] font-bold text-white shadow-[0_2px_16px_rgba(18,21,28,0.15)] transition active:scale-[0.99]"
              >
                정답 보기
              </button>
            )}
          </div>
        </>
      ) : (
        <EmptyState
          unseenTotal={queue.unseenTotal}
          nextReadyAt={queue.nextReadyAt}
          now={now}
          reviewCapped={queue.reviewCapped}
          remainingToday={remainingToday}
          onMore={() => addBonusNew(5)}
        />
      )}
    </div>
  );
}

function EmptyState({
  unseenTotal,
  nextReadyAt,
  now,
  reviewCapped,
  remainingToday,
  onMore,
}: {
  unseenTotal: number;
  nextReadyAt: Date | null;
  now: Date;
  reviewCapped: boolean;
  remainingToday: number;
  onMore: () => void;
}) {
  const allDone = unseenTotal === 0;
  return (
    <div className="kc-pop flex flex-1 flex-col items-center justify-center gap-4 rounded-3xl bg-card px-6 py-14 text-center shadow-[0_1px_2px_rgba(18,21,28,0.06)] ring-1 ring-ink-900/5">
      <div className="jp-serif text-5xl font-bold text-ink-200">{allDone ? "了" : "完"}</div>
      <div>
        <p className="text-[17px] font-bold text-ink-900">
          {allDone ? "1학년 숙어를 모두 꺼냈습니다" : "오늘 몫을 다 끝냈습니다"}
        </p>
        <p className="mt-1.5 text-[13px] leading-relaxed text-ink-500">
          {nextReadyAt
            ? `다음 카드는 약 ${humanizeInterval(nextReadyAt.getTime() - now.getTime())} 뒤에 나옵니다.`
            : reviewCapped
              ? "오늘의 복습 상한에 도달했습니다. 설정에서 상한을 올릴 수 있습니다."
              : allDone
                ? "복습 일정에 따라 다시 카드가 돌아옵니다."
                : "내일 다시 복습 큐가 채워집니다."}
        </p>
      </div>
      {!allDone && remainingToday === 0 && (
        <button
          type="button"
          onClick={onMore}
          className="rounded-full bg-ink-900 px-5 py-2.5 text-[13px] font-bold text-white transition active:scale-[0.97]"
        >
          신규 5장 더 학습하기
        </button>
      )}
    </div>
  );
}
