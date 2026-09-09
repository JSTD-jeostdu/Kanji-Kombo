import { humanizeInterval } from "../lib/date";
import { RATING_META, createCard, previewIntervalMs } from "../lib/srs";
import type { Rating, UserCard } from "../types";

const TONE: Record<Rating, string> = {
  again: "bg-rose-50 text-rose-700 ring-rose-200 active:bg-rose-100",
  hard: "bg-amber-50 text-amber-700 ring-amber-200 active:bg-amber-100",
  good: "bg-sky-50 text-sky-700 ring-sky-200 active:bg-sky-100",
  easy: "bg-emerald-50 text-emerald-700 ring-emerald-200 active:bg-emerald-100",
};

interface Props {
  compoundId: string;
  card: UserCard | null;
  now: Date;
  onRate: (rating: Rating) => void;
}

/** 자가평가 버튼 — 각 버튼에 다음 복습까지의 예상 간격을 함께 보여준다. */
export function RatingBar({ compoundId, card, now, onRate }: Props) {
  const base = card ?? createCard(compoundId, now);
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATING_META.map(({ rating, label, key }) => (
        <button
          key={rating}
          type="button"
          onClick={() => onRate(rating)}
          className={`flex flex-col items-center gap-0.5 rounded-2xl px-1 py-3 ring-1 transition active:scale-[0.97] ${TONE[rating]}`}
        >
          <span className="text-[15px] font-bold">{label}</span>
          <span className="text-[11px] tabular-nums opacity-70">
            {humanizeInterval(previewIntervalMs(base, rating, now))}
          </span>
          <span className="text-[10px] opacity-40">{key}</span>
        </button>
      ))}
    </div>
  );
}
