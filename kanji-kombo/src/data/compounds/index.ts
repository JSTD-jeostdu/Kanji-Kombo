import type { Compound } from "../../types";
import { KANJI_BY_ID, KANJI_ORDER } from "../kanji";
import type { Row } from "./row";
import { ROWS as ROWS1 } from "./part1";
import { ROWS as ROWS2 } from "./part2";
import { ROWS as ROWS3 } from "./part3";
import { ROWS as ROWS4 } from "./part4";

const ALL_ROWS: Row[] = [...ROWS1, ...ROWS2, ...ROWS3, ...ROWS4];

function toCompound([id, reading, meaningKo, jlpt, primaryKanji, examples]: Row): Compound {
  return {
    id,
    reading,
    meaningKo,
    jlpt,
    primaryKanji,
    // 표기에 실제로 등장하는 교육한자만 추린다 (勉強처럼 배당표 밖의 한자는 제외)
    kanjiIds: [...new Set([...id].filter((ch) => ch in KANJI_BY_ID))],
    examples: examples.map(([jp, ko]) => ({ jp, ko })),
  };
}

/** 배당표 순서 → 같은 한자 안에서는 원본 배열 순서. 이것이 곧 신규 카드 도입 순서다. */
export const COMPOUNDS: Compound[] = ALL_ROWS.map(toCompound)
  .map((c, i) => ({ c, i }))
  .sort((a, b) => {
    const oa = KANJI_ORDER[a.c.primaryKanji] ?? 999;
    const ob = KANJI_ORDER[b.c.primaryKanji] ?? 999;
    return oa - ob || a.i - b.i;
  })
  .map(({ c }) => c);

export const COMPOUND_BY_ID: Record<string, Compound> = Object.fromEntries(
  COMPOUNDS.map((c) => [c.id, c]),
);

/** 한자 id → 그 한자가 들어간 숙어 목록 */
export const COMPOUNDS_BY_KANJI: Record<string, Compound[]> = (() => {
  const map: Record<string, Compound[]> = {};
  for (const c of COMPOUNDS) {
    for (const k of c.kanjiIds) (map[k] ??= []).push(c);
  }
  return map;
})();
