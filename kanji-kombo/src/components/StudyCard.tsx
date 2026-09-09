import { charBreakdown } from "../data/readings";
import { KANJI_BY_ID } from "../data/kanji";
import type { Compound, UserCard } from "../types";
import { Furigana } from "./Furigana";
import { GradeBadge, JlptBadge, StageBadge } from "./ui";

interface Props {
  compound: Compound;
  card: UserCard | null;
  revealed: boolean;
  showFurigana: boolean;
  showKoreanReading: boolean;
  onReveal: () => void;
}

/** 표기 길이에 따라 글자 크기를 줄여 한 화면에 들어오게 한다. */
function headwordSize(word: string): string {
  const n = [...word].length;
  if (n <= 2) return "text-[5.5rem] leading-[1.15]";
  if (n === 3) return "text-[4.25rem] leading-[1.15]";
  if (n === 4) return "text-[3.5rem] leading-[1.2]";
  return "text-[2.75rem] leading-[1.25]";
}

/** 숙어 표기 + 읽기를 후리가나 표기법 문자열로 (예: 毎日 + まいにち → 毎日[まいにち]) */
function headwordWithRuby(compound: Compound): string {
  const chars = [...compound.id];
  const trailingKana = chars.filter((c) => !/[\u4e00-\u9fff\u3005]/.test(c)).join("");
  if (trailingKana && compound.reading.endsWith(trailingKana)) {
    const base = chars.slice(0, chars.length - [...trailingKana].length).join("");
    const reading = compound.reading.slice(0, compound.reading.length - trailingKana.length);
    return `${base}[${reading}]${trailingKana}`;
  }
  return `${compound.id}[${compound.reading}]`;
}

export function StudyCard({
  compound,
  card,
  revealed,
  showFurigana,
  showKoreanReading,
  onReveal,
}: Props) {
  const grade = KANJI_BY_ID[compound.primaryKanji]?.grade ?? 1;
  const breakdown = charBreakdown(compound.id).filter((c) => c.reading);

  return (
    <article className="rounded-3xl bg-card shadow-[0_2px_16px_rgba(18,21,28,0.07)] ring-1 ring-ink-900/5">
      <header className="flex items-center gap-1.5 px-5 pt-5">
        <GradeBadge grade={grade} />
        <JlptBadge level={compound.jlpt} />
        <div className="ml-auto">
          <StageBadge stage={card?.stage ?? "unseen"} />
        </div>
      </header>

      {/* 앞면: 숙어만 크게 — 시선이 한자에 먼저 머물도록 (PRD 3.1) */}
      <div
        role={revealed ? undefined : "button"}
        tabIndex={revealed ? undefined : 0}
        onClick={revealed ? undefined : onReveal}
        className={`px-5 ${revealed ? "pt-6 pb-4" : "flex min-h-[16rem] cursor-pointer flex-col items-center justify-center py-10"}`}
      >
        <div
          className={`jp-serif text-center font-bold text-ink-900 ${headwordSize(compound.id)}`}
        >
          {revealed ? (
            <Furigana text={headwordWithRuby(compound)} show className="jp-serif" />
          ) : (
            compound.id
          )}
        </div>

        {!revealed && (
          <p className="mt-7 text-[12px] text-ink-300">카드를 탭하면 뒤집힙니다</p>
        )}
      </div>

      {revealed && (
        <div className="kc-slide space-y-5 px-5 pb-6">
          <p className="text-center text-lg font-semibold text-ink-900">{compound.meaningKo}</p>

          <dl className="divide-y divide-ink-100 rounded-2xl bg-paper/70 px-4">
            <div className="flex items-baseline gap-3 py-2.5">
              <dt className="w-20 shrink-0 text-[12px] font-semibold text-ink-400">일본어 독음</dt>
              <dd className="jp text-[15px] font-medium text-ink-800">{compound.reading}</dd>
            </div>
            {showKoreanReading && (
              <div className="flex items-baseline gap-3 py-2.5">
                <dt className="w-20 shrink-0 text-[12px] font-semibold text-ink-400">한국어 독음</dt>
                <dd className="text-[15px] font-medium text-ink-800">
                  {breakdown.map((b) => b.reading!.krEum[0]).join("·")}
                </dd>
              </div>
            )}
          </dl>

          {/* 한·일 독음 병렬 표기 (PRD 3.3) */}
          <div>
            <h3 className="mb-2 text-[12px] font-bold tracking-wide text-ink-400">한자 풀이</h3>
            <ul className="space-y-1.5">
              {breakdown.map(({ char, reading }, i) => (
                <li
                  key={`${char}-${i}`}
                  className="flex items-center gap-3 rounded-xl bg-paper/70 px-3 py-2"
                >
                  <span
                    className={`jp-serif w-9 shrink-0 text-center text-3xl font-bold ${
                      reading!.inCurriculum ? "text-ink-900" : "text-ink-400"
                    }`}
                  >
                    {char}
                  </span>
                  <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed">
                    <div className="jp text-ink-700">
                      <span className="mr-1 text-[10px] font-bold text-ink-300">音</span>
                      {reading!.on.join("・") || "—"}
                      <span className="mx-1.5 text-ink-200">|</span>
                      <span className="mr-1 text-[10px] font-bold text-ink-300">訓</span>
                      {reading!.kun.join("・") || "—"}
                    </div>
                    {showKoreanReading && (
                      <div className="text-ink-500">
                        {reading!.krHun.map((hun, j) => `${hun} ${reading!.krEum[j] ?? ""}`).join(" · ")}
                      </div>
                    )}
                  </div>
                  {!reading!.inCurriculum && (
                    <span className="shrink-0 text-[10px] text-ink-300">배당표 밖</span>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* 활용 예문 (PRD 3.4) */}
          <div>
            <h3 className="mb-2 text-[12px] font-bold tracking-wide text-ink-400">
              예문 {compound.examples.length}
            </h3>
            <ol className="space-y-3">
              {compound.examples.map((ex, i) => (
                <li key={i} className="rounded-xl bg-paper/70 px-3 py-2.5">
                  <p className="jp text-[16px] leading-[2.1] text-ink-900">
                    <Furigana text={ex.jp} show={showFurigana} />
                  </p>
                  <p className="mt-1 text-[13px] text-ink-500">{ex.ko}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      )}
    </article>
  );
}
