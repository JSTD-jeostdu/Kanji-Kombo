import type { ReactNode } from "react";
import type { CardStage, JlptLevel } from "../types";

const JLPT_TONE: Record<JlptLevel, string> = {
  N5: "bg-emerald-100 text-emerald-800",
  N4: "bg-sky-100 text-sky-800",
  N3: "bg-amber-100 text-amber-800",
  N2: "bg-orange-100 text-orange-800",
  N1: "bg-rose-100 text-rose-800",
};

export function JlptBadge({ level }: { level: JlptLevel }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold tracking-wide ${JLPT_TONE[level]}`}
    >
      {level}
    </span>
  );
}

export function GradeBadge({ grade }: { grade: number }) {
  return (
    <span className="inline-flex items-center rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-bold text-white">
      교육 {grade}학년
    </span>
  );
}

const STAGE_META: Record<CardStage, { label: string; tone: string }> = {
  new: { label: "신규", tone: "bg-ink-200 text-ink-700" },
  learning: { label: "학습중", tone: "bg-vermilion-500/15 text-vermilion-600" },
  review: { label: "복습중", tone: "bg-sky-100 text-sky-700" },
  mature: { label: "성숙", tone: "bg-emerald-100 text-emerald-700" },
};

export function StageBadge({ stage }: { stage: CardStage | "unseen" }) {
  if (stage === "unseen") {
    return (
      <span className="inline-flex items-center rounded-full bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-400">
        미학습
      </span>
    );
  }
  const meta = STAGE_META[stage];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.tone}`}
    >
      {meta.label}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-card p-4 shadow-[0_1px_2px_rgba(18,21,28,0.06)] ring-1 ring-ink-900/5">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[13px] font-bold tracking-wide text-ink-500">{title}</h2>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Stat({ value, label, hint }: { value: ReactNode; label: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-card p-4 text-center shadow-[0_1px_2px_rgba(18,21,28,0.06)] ring-1 ring-ink-900/5">
      <div className="text-2xl font-bold tabular-nums text-ink-900">{value}</div>
      <div className="mt-0.5 text-[12px] font-medium text-ink-500">{label}</div>
      {hint && <div className="mt-1 text-[11px] text-ink-400">{hint}</div>}
    </div>
  );
}

export function ProgressBar({ value, max, tone = "bg-ink-900" }: { value: number; max: number; tone?: string }) {
  const pct = max === 0 ? 0 : Math.min(100, (value / max) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-paper-sunk">
      <div className={`h-full rounded-full transition-[width] duration-500 ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
