import { useMemo, useState, type ReactNode } from "react";
import { Sheet } from "../components/Sheet";
import { StudyCard } from "../components/StudyCard";
import { JlptBadge, StageBadge } from "../components/ui";
import { COMPOUNDS, COMPOUNDS_BY_KANJI } from "../data/compounds";
import { KANJI } from "../data/kanji";
import { koreanReadingOf } from "../data/readings";
import { useApp } from "../store/appContext";
import type { Compound, JlptLevel, Kanji } from "../types";

type View = "kanji" | "compound";
type StatusFilter = "all" | "unseen" | "learning" | "review" | "mature";

const JLPT_ORDER: JlptLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function Browse() {
  const { state } = useApp();
  const [view, setView] = useState<View>("kanji");
  const [query, setQuery] = useState("");
  const [jlpt, setJlpt] = useState<JlptLevel | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [openKanji, setOpenKanji] = useState<Kanji | null>(null);
  const [openCompound, setOpenCompound] = useState<Compound | null>(null);

  const raw = query.trim();
  const q = raw.toLowerCase();

  const compounds = useMemo(
    () =>
      COMPOUNDS.filter((c) => {
        if (jlpt !== "all" && c.jlpt !== jlpt) return false;
        if (status !== "all") {
          const card = state.cards[c.id];
          if (status === "unseen" ? Boolean(card) : card?.stage !== status) return false;
        }
        if (!q) return true;
        return (
          c.id.includes(raw) ||
          c.reading.includes(raw) ||
          c.meaningKo.toLowerCase().includes(q) ||
          koreanReadingOf(c.id).includes(raw)
        );
      }),
    [jlpt, status, q, raw, state.cards],
  );

  const kanjiList = useMemo(
    () =>
      KANJI.filter((k) => {
        if (jlpt !== "all" && k.jlpt !== jlpt) return false;
        const related = COMPOUNDS_BY_KANJI[k.id] ?? [];
        if (status !== "all") {
          const anyMatch = related.some((c) => {
            const card = state.cards[c.id];
            return status === "unseen" ? !card : card?.stage === status;
          });
          if (!anyMatch) return false;
        }
        if (!q) return true;
        return (
          k.id.includes(raw) ||
          k.meaningKo.toLowerCase().includes(q) ||
          k.krEum.some((e) => e.includes(raw)) ||
          k.krHun.some((h) => h.includes(raw)) ||
          k.on.some((o) => o.includes(raw)) ||
          k.kun.some((o) => o.includes(raw))
        );
      }),
    [jlpt, status, q, raw, state.cards],
  );

  return (
    <div className="mx-auto w-full max-w-lg px-4 pt-4 pb-6">
      <div className="mb-3 flex gap-1 rounded-full bg-paper-sunk p-1">
        {(
          [
            ["kanji", `한자 ${kanjiList.length}`],
            ["compound", `숙어 ${compounds.length}`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id as View)}
            className={`flex-1 rounded-full py-2 text-[13px] font-bold transition ${
              view === id ? "bg-card text-ink-900 shadow-sm" : "text-ink-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="한자 · 읽기 · 뜻 · 한국음으로 검색"
        className="w-full rounded-2xl bg-card px-4 py-3 text-[14px] text-ink-900 ring-1 ring-ink-900/8 outline-none placeholder:text-ink-300 focus:ring-2 focus:ring-ink-900/25"
      />

      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <Chip active={jlpt === "all"} onClick={() => setJlpt("all")}>
          전체 급수
        </Chip>
        {JLPT_ORDER.map((level) => (
          <Chip key={level} active={jlpt === level} onClick={() => setJlpt(level)}>
            {level}
          </Chip>
        ))}
        <span className="mx-1 w-px shrink-0 bg-ink-200" />
        {(
          [
            ["all", "전체"],
            ["unseen", "미학습"],
            ["learning", "학습중"],
            ["review", "복습중"],
            ["mature", "성숙"],
          ] as const
        ).map(([id, label]) => (
          <Chip key={id} active={status === id} onClick={() => setStatus(id as StatusFilter)}>
            {label}
          </Chip>
        ))}
      </div>

      {view === "kanji" ? (
        <div className="mt-4 grid grid-cols-5 gap-2 sm:grid-cols-6">
          {kanjiList.map((k) => {
            const related = COMPOUNDS_BY_KANJI[k.id] ?? [];
            const seen = related.filter((c) => state.cards[c.id]).length;
            const ratio = related.length === 0 ? 0 : seen / related.length;
            return (
              <button
                key={k.id}
                type="button"
                onClick={() => setOpenKanji(k)}
                className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-2xl bg-card pb-1 ring-1 ring-ink-900/6 transition active:scale-[0.96]"
              >
                <span className="jp-serif text-[1.7rem] leading-none font-bold text-ink-900">
                  {k.id}
                </span>
                <span className="mt-1.5 w-full truncate px-1 text-center text-[10px] leading-none text-ink-400">
                  {k.krHun[0]} {k.krEum[0]}
                </span>
                <span className="absolute inset-x-0 bottom-0 h-[3px] bg-paper-sunk" aria-hidden>
                  <span
                    className="block h-full bg-vermilion-500"
                    style={{ width: `${ratio * 100}%` }}
                  />
                </span>
              </button>
            );
          })}
          {kanjiList.length === 0 && <Empty />}
        </div>
      ) : (
        <ul className="mt-4 space-y-2">
          {compounds.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setOpenCompound(c)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-ink-900/6 transition active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <div className="jp-serif text-xl font-bold text-ink-900">{c.id}</div>
                  <div className="jp mt-0.5 text-[12px] text-ink-400">{c.reading}</div>
                  <div className="mt-0.5 truncate text-[13px] text-ink-600">{c.meaningKo}</div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <JlptBadge level={c.jlpt} />
                  <StageBadge stage={state.cards[c.id]?.stage ?? "unseen"} />
                </div>
              </button>
            </li>
          ))}
          {compounds.length === 0 && <Empty />}
        </ul>
      )}

      {openKanji && (
        <Sheet
          onClose={() => setOpenKanji(null)}
          title={`${openKanji.id} · ${openKanji.krHun[0]} ${openKanji.krEum[0]}`}
        >
          <KanjiDetail
            kanji={openKanji}
            onPickCompound={(c) => {
              setOpenKanji(null);
              setOpenCompound(c);
            }}
          />
        </Sheet>
      )}

      {openCompound && (
        <Sheet onClose={() => setOpenCompound(null)} title={`${openCompound.id} · ${openCompound.meaningKo}`}>
          <StudyCard
            compound={openCompound}
            card={state.cards[openCompound.id] ?? null}
            revealed
            showFurigana={state.settings.furiganaDefault}
            showKoreanReading={state.settings.showKoreanReading}
            onReveal={() => {}}
          />
        </Sheet>
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold ring-1 transition ${
        active ? "bg-ink-900 text-white ring-ink-900" : "bg-card text-ink-500 ring-ink-900/10"
      }`}
    >
      {children}
    </button>
  );
}

function Empty() {
  return (
    <p className="col-span-full py-12 text-center text-[13px] text-ink-400">
      조건에 맞는 항목이 없습니다.
    </p>
  );
}

function KanjiDetail({
  kanji,
  onPickCompound,
}: {
  kanji: Kanji;
  onPickCompound: (c: Compound) => void;
}) {
  const { state } = useApp();
  const related = COMPOUNDS_BY_KANJI[kanji.id] ?? [];
  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-card p-6 text-center ring-1 ring-ink-900/5">
        <div className="jp-serif text-[6rem] leading-none font-bold text-ink-900">{kanji.id}</div>
        <div className="mt-4 flex items-center justify-center gap-1.5">
          <JlptBadge level={kanji.jlpt} />
          <span className="rounded-full bg-ink-900 px-2 py-0.5 text-[11px] font-bold text-white">
            교육 {kanji.grade}학년
          </span>
          <span className="rounded-full bg-paper-sunk px-2 py-0.5 text-[11px] font-semibold text-ink-500">
            {kanji.strokes}획
          </span>
        </div>
        <dl className="mt-4 space-y-1.5 text-left text-[13px]">
          <DetailRow label="음독" value={kanji.on.join("・") || "—"} jp />
          <DetailRow label="훈독" value={kanji.kun.join("・") || "—"} jp />
          <DetailRow
            label="한국 음훈"
            value={kanji.krHun.map((h, i) => `${h} ${kanji.krEum[i] ?? ""}`).join(" · ")}
          />
          <DetailRow label="뜻" value={kanji.meaningKo} />
        </dl>
      </div>

      <div>
        <h3 className="mb-2 text-[12px] font-bold text-ink-400">
          이 한자가 들어간 숙어 {related.length}개
        </h3>
        <ul className="space-y-2">
          {related.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPickCompound(c)}
                className="flex w-full items-center gap-3 rounded-2xl bg-card px-4 py-3 text-left ring-1 ring-ink-900/6"
              >
                <div className="min-w-0 flex-1">
                  <span className="jp-serif text-lg font-bold text-ink-900">{c.id}</span>
                  <span className="jp ml-2 text-[12px] text-ink-400">{c.reading}</span>
                  <div className="truncate text-[13px] text-ink-600">{c.meaningKo}</div>
                </div>
                <StageBadge stage={state.cards[c.id]?.stage ?? "unseen"} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function DetailRow({ label, value, jp }: { label: string; value: string; jp?: boolean }) {
  return (
    <div className="flex gap-3">
      <dt className="w-16 shrink-0 font-semibold text-ink-400">{label}</dt>
      <dd className={`text-ink-800 ${jp ? "jp" : ""}`}>{value}</dd>
    </div>
  );
}

