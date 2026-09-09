/**
 * 워크시트(학습지) 생성용 데이터 내보내기. `npm run export:worksheet`
 *
 * 앱 데이터를 그대로 쓰되, 워드에서 바로 조판할 수 있는 평평한 JSON으로 바꾼다.
 * - 예문은 후리가나 표기를 벗긴 원문과 전부 가나로 바꾼 읽기를 둘 다 담는다
 * - 숙어를 이루는 글자마다 한·일 독음을 붙여 둔다 (배당표 밖 한자 포함)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { KANJI } from "../src/data/kanji";
import { COMPOUNDS } from "../src/data/compounds";
import { charBreakdown } from "../src/data/readings";
import { stripFurigana, toKana } from "../src/lib/furigana";

interface CharInfo {
  char: string;
  on: string[];
  kun: string[];
  krEum: string[];
  krHun: string[];
  inCurriculum: boolean;
}

interface ExampleOut {
  jp: string;
  kana: string;
  ko: string;
}

interface CompoundOut {
  word: string;
  reading: string;
  meaningKo: string;
  jlpt: string;
  chars: CharInfo[];
  examples: ExampleOut[];
}

interface KanjiOut {
  index: number;
  char: string;
  strokes: number;
  grade: number;
  jlpt: string;
  on: string[];
  kun: string[];
  krEum: string[];
  krHun: string[];
  meaningKo: string;
  compounds: CompoundOut[];
}

const out: KanjiOut[] = KANJI.map((k, i) => ({
  index: i + 1,
  char: k.id,
  strokes: k.strokes,
  grade: k.grade,
  jlpt: k.jlpt,
  on: k.on,
  kun: k.kun,
  krEum: k.krEum,
  krHun: k.krHun,
  meaningKo: k.meaningKo,
  compounds: COMPOUNDS.filter((c) => c.primaryKanji === k.id).map((c) => ({
    word: c.id,
    reading: c.reading,
    meaningKo: c.meaningKo,
    jlpt: c.jlpt,
    chars: charBreakdown(c.id)
      .filter((b) => b.reading)
      .map((b) => ({
        char: b.char,
        on: b.reading!.on,
        kun: b.reading!.kun,
        krEum: b.reading!.krEum,
        krHun: b.reading!.krHun,
        inCurriculum: b.reading!.inCurriculum,
      })),
    examples: c.examples.map((ex) => ({
      jp: stripFurigana(ex.jp),
      kana: toKana(ex.jp),
      ko: ex.ko,
    })),
  })),
}));

mkdirSync("worksheet", { recursive: true });
writeFileSync("worksheet/data.json", JSON.stringify(out, null, 1), "utf8");

const compounds = out.reduce((n, k) => n + k.compounds.length, 0);
const examples = out.reduce(
  (n, k) => n + k.compounds.reduce((m, c) => m + c.examples.length, 0),
  0,
);
const maxLen = Math.max(...out.flatMap((k) => k.compounds.map((c) => [...c.word].length)));
const noCompound = out.filter((k) => k.compounds.length === 0).map((k) => k.char);

console.log(`한자 ${out.length}자 · 숙어 ${compounds}개 · 예문 ${examples}개`);
console.log(`가장 긴 숙어 길이: ${maxLen}자`);
if (noCompound.length > 0) console.warn(`대표 숙어가 없는 한자: ${noCompound.join(" ")}`);
console.log("worksheet/data.json 저장 완료");
