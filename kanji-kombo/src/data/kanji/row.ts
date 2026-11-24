import type { JlptLevel } from "../../types";

/**
 * 한자 한 줄.
 * [한자, 획수, JLPT, 음독(・), 훈독(・), 한국음(·), 한국훈(·), 대표뜻]
 *
 * - 훈독의 `.`는 送り仮名 경계 (예: `やす.む` → 休む)
 * - 한국음/한국훈은 같은 순서로 짝을 이룬다 (예: 매 ↔ 매양)
 */
export type Row = [string, number, JlptLevel, string, string, string, string, string];

export const splitReadings = (s: string): string[] => (s === "—" ? [] : s.split("・"));
