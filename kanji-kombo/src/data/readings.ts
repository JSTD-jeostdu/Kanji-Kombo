import { KANJI_BY_ID } from "./kanji";
import { SUPPLEMENT, type CharReading } from "./supplement";

/** 한자 한 글자의 한·일 독음. 배당표 한자를 우선하고, 없으면 보조표를 본다. */
export function readingFor(char: string): CharReading | null {
  const k = KANJI_BY_ID[char];
  if (k) {
    return {
      id: k.id,
      on: k.on,
      kun: k.kun,
      krEum: k.krEum,
      krHun: k.krHun,
      inCurriculum: true,
    };
  }
  return SUPPLEMENT[char] ?? null;
}

/** 숙어 표기를 글자 단위로 쪼개 독음을 붙인다 (가나는 null). */
export function charBreakdown(word: string): { char: string; reading: CharReading | null }[] {
  return [...word].map((char) => ({ char, reading: readingFor(char) }));
}

/** 한국 한자음을 이어 붙인 표기. 예: 毎日 → 매·일 */
export function koreanReadingOf(word: string): string {
  const parts = charBreakdown(word)
    .filter((c) => c.reading)
    .map((c) => c.reading!.krEum[0]);
  return parts.join("·");
}
