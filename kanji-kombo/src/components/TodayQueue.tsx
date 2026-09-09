import { COMPOUND_BY_ID } from "../data/compounds";
import { humanizeInterval } from "../lib/date";
import { unseenCompoundIds } from "../lib/queue";
import { useApp } from "../store/appContext";
import type { CardStage } from "../types";
import { JlptBadge, StageBadge } from "./ui";

/** 오늘의 복습 큐 (PRD 8장) — 지금 볼 카드, 곧 돌아올 카드, 오늘 나올 신규 카드. */
export function TodayQueue() {
  const { state, queue, now } = useApp();

  const upcomingNew = unseenCompoundIds(state).slice(0, queue.newRemaining);
  const total = queue.dueNow.length + queue.pending.length + upcomingNew.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-2">
        <Tally value={queue.dueNow.length} label="지금 복습" tone="text-vermilion-600" />
        <Tally value={queue.pending.length} label="곧 다시" tone="text-sky-600" />
        <Tally value={upcomingNew.length} label="남은 신규" tone="text-ink-900" />
      </div>

      {total === 0 && (
        <p className="rounded-2xl bg-card px-4 py-10 text-center text-[13px] text-ink-400 ring-1 ring-ink-900/5">
          오늘 대기 중인 카드가 없습니다.
        </p>
      )}

      {queue.dueNow.length > 0 && (
        <Group title="지금 복습할 카드" count={queue.dueNow.length}>
          {queue.dueNow.map((card) => (
            <Row
              key={card.compoundId}
              compoundId={card.compoundId}
              stage={card.stage}
              trailing={dueLabel(card.dueAt, now)}
            />
          ))}
        </Group>
      )}

      {queue.pending.length > 0 && (
        <Group title="곧 다시 나올 카드" count={queue.pending.length}>
          {queue.pending.map((card) => (
            <Row
              key={card.compoundId}
              compoundId={card.compoundId}
              stage={card.stage}
              trailing={`${humanizeInterval(new Date(card.dueAt).getTime() - now.getTime())} 뒤`}
            />
          ))}
        </Group>
      )}

      {upcomingNew.length > 0 && (
        <Group title="오늘 나올 신규 카드" count={upcomingNew.length}>
          {upcomingNew.map((id) => (
            <Row key={id} compoundId={id} stage="unseen" trailing="대기" />
          ))}
        </Group>
      )}

      {queue.reviewCapped && (
        <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 ring-1 ring-amber-200">
          오늘의 복습 상한({state.settings.dailyReviewCap}장)에 도달해 복습 카드는 더 나오지 않습니다.
          학습 단계 카드는 계속 나옵니다.
        </p>
      )}
    </div>
  );
}

function dueLabel(dueAt: string, now: Date): string {
  const diff = now.getTime() - new Date(dueAt).getTime();
  if (diff < 60 * 1000) return "지금";
  return `${humanizeInterval(diff)} 지남`;
}

function Tally({ value, label, tone }: { value: number; label: string; tone: string }) {
  return (
    <div className="rounded-2xl bg-card py-3 text-center ring-1 ring-ink-900/5">
      <div className={`text-xl font-bold tabular-nums ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[11px] font-medium text-ink-400">{label}</div>
    </div>
  );
}

function Group({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="mb-2 flex items-baseline gap-2 text-[12px] font-bold text-ink-400">
        {title}
        <span className="tabular-nums text-ink-300">{count}</span>
      </h3>
      <ul className="space-y-1.5">{children}</ul>
    </section>
  );
}

function Row({
  compoundId,
  stage,
  trailing,
}: {
  compoundId: string;
  stage: CardStage | "unseen";
  trailing: string;
}) {
  const compound = COMPOUND_BY_ID[compoundId];
  if (!compound) return null;
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-card px-3.5 py-2.5 ring-1 ring-ink-900/6">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="jp-serif text-lg font-bold text-ink-900">{compound.id}</span>
          <span className="jp truncate text-[11.5px] text-ink-400">{compound.reading}</span>
        </div>
        <div className="truncate text-[12.5px] text-ink-600">{compound.meaningKo}</div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <JlptBadge level={compound.jlpt} />
          <StageBadge stage={stage} />
        </div>
        <span className="text-[11px] tabular-nums text-ink-400">{trailing}</span>
      </div>
    </li>
  );
}
