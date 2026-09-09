import { useMemo } from "react";
import { ProgressBar, Section, Stat } from "../components/ui";
import { formatDayKey } from "../lib/date";
import { forecast, gradeProgress, recentActivity, summarize } from "../lib/stats";
import { useApp } from "../store/appContext";
import type { CardStage } from "../types";

const STAGE_ROWS: { stage: CardStage; label: string; tone: string }[] = [
  { stage: "new", label: "신규", tone: "bg-ink-300" },
  { stage: "learning", label: "학습중", tone: "bg-vermilion-500" },
  { stage: "review", label: "복습중", tone: "bg-sky-500" },
  { stage: "mature", label: "성숙", tone: "bg-emerald-500" },
];

export function Stats() {
  const { state, now } = useApp();

  const summary = useMemo(() => summarize(state, now), [state, now]);
  const activity = useMemo(() => recentActivity(state, 30), [state]);
  const upcoming = useMemo(() => forecast(state, 14), [state]);
  const grades = useMemo(() => gradeProgress(state), [state]);

  const maxActivity = Math.max(1, ...activity.map((d) => d.reviews));
  const maxForecast = Math.max(1, ...upcoming.map((d) => d.count));
  const totalCards = Math.max(1, summary.seenCompounds);

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-4 pt-4 pb-6">
      <div className="grid grid-cols-3 gap-2">
        <Stat
          value={`${summary.streak}일`}
          label="연속 학습"
          hint={`최고 ${summary.bestStreak}일`}
        />
        <Stat value={summary.reviewsToday} label="오늘 채점" hint={`누적 ${summary.totalReviews}회`} />
        <Stat
          value={summary.totalReviews === 0 ? "—" : `${Math.round(summary.accuracy * 100)}%`}
          label="정답률"
          hint="'다시'를 제외한 비율"
        />
      </div>

      <Section title="커버리지">
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-ink-700">교육한자 1학년</span>
              <span className="tabular-nums text-ink-400">
                {summary.kanjiTouched} / {summary.totalKanji}자
              </span>
            </div>
            <ProgressBar value={summary.kanjiTouched} max={summary.totalKanji} tone="bg-vermilion-500" />
            <p className="mt-1.5 text-[11px] text-ink-400">
              숙어를 전부 학습한 한자 {summary.kanjiCompleted}자
            </p>
          </div>
          <div>
            <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
              <span className="font-semibold text-ink-700">숙어 카드</span>
              <span className="tabular-nums text-ink-400">
                {summary.seenCompounds} / {summary.totalCompounds}개
              </span>
            </div>
            <ProgressBar value={summary.seenCompounds} max={summary.totalCompounds} />
          </div>
          {grades.length > 1 &&
            grades.map((g) => (
              <div key={g.grade}>
                <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                  <span className="font-semibold text-ink-700">{g.grade}학년</span>
                  <span className="tabular-nums text-ink-400">
                    {g.touched} / {g.total}자
                  </span>
                </div>
                <ProgressBar value={g.touched} max={g.total} />
              </div>
            ))}
        </div>
      </Section>

      <Section title="카드 상태">
        {summary.seenCompounds === 0 ? (
          <p className="py-4 text-center text-[13px] text-ink-400">아직 학습한 카드가 없습니다.</p>
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-paper-sunk">
              {STAGE_ROWS.map((row) => {
                const count = summary.stageCounts[row.stage];
                if (count === 0) return null;
                return (
                  <div
                    key={row.stage}
                    className={row.tone}
                    style={{ width: `${(count / totalCards) * 100}%` }}
                    title={`${row.label} ${count}`}
                  />
                );
              })}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-y-1.5">
              {STAGE_ROWS.map((row) => (
                <li key={row.stage} className="flex items-center gap-2 text-[12.5px]">
                  <span className={`h-2.5 w-2.5 rounded-full ${row.tone}`} />
                  <span className="text-ink-600">{row.label}</span>
                  <span className="ml-auto pr-3 font-semibold tabular-nums text-ink-800">
                    {summary.stageCounts[row.stage]}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Section title="최근 30일 학습량">
        <div className="flex h-24 items-end gap-[3px]">
          {activity.map((d) => (
            <div key={d.day} className="group relative flex-1" title={`${formatDayKey(d.day)} · ${d.reviews}회`}>
              <div
                className={`w-full rounded-t-sm ${d.reviews > 0 ? "bg-ink-900" : "bg-paper-sunk"}`}
                style={{ height: `${Math.max(3, (d.reviews / maxActivity) * 96)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
          <span>{formatDayKey(activity[0].day)}</span>
          <span>오늘</span>
        </div>
      </Section>

      <Section title="복습 예정 (14일)">
        <div className="flex h-20 items-end gap-1">
          {upcoming.map((d, i) => (
            <div key={d.day} className="flex-1" title={`${formatDayKey(d.day)} · ${d.count}장`}>
              <div
                className={`w-full rounded-t-sm ${i === 0 ? "bg-vermilion-500" : "bg-sky-400"}`}
                style={{ height: `${Math.max(2, (d.count / maxForecast) * 80)}px` }}
              />
            </div>
          ))}
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-ink-400">
          <span>오늘 {upcoming[0].count}장</span>
          <span>2주 뒤</span>
        </div>
      </Section>
    </div>
  );
}
