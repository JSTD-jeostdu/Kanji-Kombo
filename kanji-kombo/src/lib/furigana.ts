/**
 * 후리가나 표기법 파서.
 *
 * `毎日[まいにち]日本語[にほんご]を勉強[べんきょう]します。`
 *   → [ruby 毎日/まいにち][ruby 日本語/にほんご]を[ruby 勉強/べんきょう]します。
 *
 * 대괄호 바로 앞의 한자(및 々) 덩어리에만 루비가 붙고, 나머지는 평문으로 남는다.
 */

export type Token =
  | { kind: "text"; text: string }
  | { kind: "ruby"; base: string; reading: string };

const KANJI_RUN = /[\u4e00-\u9fff\u3005\u3006\u30f6]+$/;
const BRACKET = /\[([^\]]*)\]/g;

export function parseFurigana(source: string): Token[] {
  const tokens: Token[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;
  BRACKET.lastIndex = 0;

  while ((match = BRACKET.exec(source)) !== null) {
    const before = source.slice(cursor, match.index);
    const runMatch = before.match(KANJI_RUN);
    if (!runMatch) {
      // 앞에 한자가 없으면 루비를 붙일 대상이 없다 — 대괄호째 평문으로 둔다
      tokens.push({ kind: "text", text: before + match[0] });
    } else {
      const plain = before.slice(0, before.length - runMatch[0].length);
      if (plain) tokens.push({ kind: "text", text: plain });
      tokens.push({ kind: "ruby", base: runMatch[0], reading: match[1] });
    }
    cursor = match.index + match[0].length;
  }

  const tail = source.slice(cursor);
  if (tail) tokens.push({ kind: "text", text: tail });
  return tokens;
}

/** 후리가나 표기를 제거한 순수 일본어 문장 */
export function stripFurigana(source: string): string {
  return source.replace(/\[[^\]]*\]/g, "");
}

/** 한자를 모두 읽기로 바꾼 가나 문장 (음성 합성·검색용) */
export function toKana(source: string): string {
  return parseFurigana(source)
    .map((t) => (t.kind === "ruby" ? t.reading : t.text))
    .join("");
}
