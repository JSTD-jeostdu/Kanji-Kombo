import type { Kanji } from "../../types";
import { splitReadings, type Row } from "./row";
import { ROWS as GRADE1 } from "./grade1";
import { ROWS as GRADE2 } from "./grade2";

/**
 * 교육한자. 학년별 배당표 순서가 곧 학습 진도 순서다.
 *
 * 학년을 넓힐 때는 gradeN.ts를 추가하고 아래 GRADES에만 이어 붙이면 된다.
 * 기존 한자의 순서(=진도)는 바뀌지 않으므로 학습 기록에 영향이 없다.
 */
const GRADES: { grade: number; rows: Row[] }[] = [
  { grade: 1, rows: GRADE1 },
  { grade: 2, rows: GRADE2 },
];

export const KANJI: Kanji[] = GRADES.flatMap(({ grade, rows }) =>
  rows.map(([id, strokes, jlpt, on, kun, eum, hun, meaningKo]) => ({
    id,
    strokes,
    grade,
    jlpt,
    on: splitReadings(on),
    kun: splitReadings(kun),
    krEum: eum.split("·"),
    krHun: hun.split("·"),
    meaningKo,
  })),
);

export const KANJI_BY_ID: Record<string, Kanji> = Object.fromEntries(
  KANJI.map((k) => [k.id, k]),
);

/** 배당표 순서 = 학습 진도 순서 */
export const KANJI_ORDER: Record<string, number> = Object.fromEntries(
  KANJI.map((k, i) => [k.id, i]),
);
