/**
 * 데이터셋 무결성 검사. `npm run validate`
 *
 * 한자·숙어·예문은 손으로 쓰는 데이터라 오탈자가 나기 쉽다.
 * 여기서 걸러지는 것만이라도 기계적으로 잡아 둔다.
 */
import { KANJI, KANJI_BY_ID } from "../src/data/kanji";
import { COMPOUNDS, COMPOUNDS_BY_KANJI } from "../src/data/compounds";
import { parseFurigana, stripFurigana } from "../src/lib/furigana";
import { readingFor } from "../src/data/readings";
import { SUPPLEMENT } from "../src/data/supplement";

const errors: string[] = [];
const warnings: string[] = [];

const KANA = /^[\u3040-\u309f\u30a0-\u30ff\u30fcー]+$/;
const LATIN = /[A-Za-z]/;

// --- 한자 ---
const byGrade = new Map<number, number>();
for (const k of KANJI) byGrade.set(k.grade, (byGrade.get(k.grade) ?? 0) + 1);
if (byGrade.get(1) !== 80) errors.push(`교육한자 1학년은 80자여야 하는데 ${byGrade.get(1)}자입니다.`);
if ((byGrade.get(2) ?? 0) > 160) errors.push(`교육한자 2학년이 160자를 넘습니다 (${byGrade.get(2)}자).`);
const kanjiSeen = new Set<string>();
for (const k of KANJI) {
  if (kanjiSeen.has(k.id)) errors.push(`한자 중복: ${k.id}`);
  kanjiSeen.add(k.id);
  if (k.krEum.length !== k.krHun.length)
    errors.push(`${k.id}: 한국음(${k.krEum.length})과 훈(${k.krHun.length}) 개수가 다릅니다.`);
  if (k.on.length === 0 && k.kun.length === 0) errors.push(`${k.id}: 음독·훈독이 모두 비었습니다.`);
  if (k.strokes < 1 || k.strokes > 30) errors.push(`${k.id}: 획수(${k.strokes})가 이상합니다.`);
}

// --- 숙어 ---
const compoundSeen = new Set<string>();
for (const c of COMPOUNDS) {
  if (compoundSeen.has(c.id)) errors.push(`숙어 중복: ${c.id}`);
  compoundSeen.add(c.id);

  if (!KANA.test(c.reading)) errors.push(`${c.id}: 읽기 "${c.reading}"에 가나가 아닌 문자가 있습니다.`);
  if (!(c.primaryKanji in KANJI_BY_ID))
    errors.push(`${c.id}: 대표한자 ${c.primaryKanji}가 1학년 배당표에 없습니다.`);
  if (!c.id.includes(c.primaryKanji))
    errors.push(`${c.id}: 대표한자 ${c.primaryKanji}가 표기에 들어 있지 않습니다.`);
  if (c.kanjiIds.length === 0) errors.push(`${c.id}: 연결된 교육한자가 없습니다.`);
  if (c.examples.length < 2) errors.push(`${c.id}: 예문이 ${c.examples.length}개뿐입니다 (최소 2개).`);

  for (const ex of c.examples) {
    if (LATIN.test(ex.jp)) errors.push(`${c.id}: 예문에 로마자가 섞여 있습니다 — ${ex.jp}`);
    const opens = (ex.jp.match(/\[/g) ?? []).length;
    const closes = (ex.jp.match(/\]/g) ?? []).length;
    if (opens !== closes) errors.push(`${c.id}: 후리가나 대괄호가 맞지 않습니다 — ${ex.jp}`);

    for (const t of parseFurigana(ex.jp)) {
      if (t.kind === "ruby" && !KANA.test(t.reading))
        errors.push(`${c.id}: 후리가나 "${t.reading}"가 가나가 아닙니다 — ${ex.jp}`);
    }

    // 후리가나를 지운 문장에 한자가 남아 있으면 읽기를 빠뜨린 것
    const bare = stripFurigana(ex.jp);
    const naked = [...bare].filter((ch) => /[\u4e00-\u9fff]/.test(ch));
    const covered = new Set(
      parseFurigana(ex.jp).flatMap((t) => (t.kind === "ruby" ? [...t.base] : [])),
    );
    const missing = naked.filter((ch) => !covered.has(ch));
    if (missing.length > 0)
      warnings.push(`${c.id}: 후리가나 없는 한자 ${missing.join("")} — ${ex.jp}`);

    if (!ex.ko.trim()) errors.push(`${c.id}: 한국어 번역이 비었습니다 — ${ex.jp}`);
  }
}

// --- 배당표와 보조표 중복 ---
const dupes = KANJI.filter((k) => k.id in SUPPLEMENT).map((k) => k.id);
if (dupes.length > 0)
  errors.push(`배당표와 보조표에 중복된 한자: ${dupes.join(" ")} (supplement.ts에서 지워야 합니다)`);

// --- 독음 병기 ---
// 숙어 표기에 나오는 모든 한자는 한·일 독음을 보여줄 수 있어야 한다.
const noReading = new Set<string>();
for (const c of COMPOUNDS)
  for (const ch of c.id)
    if (/[一-鿿]/.test(ch) && !readingFor(ch)) noReading.add(ch);
if (noReading.size > 0)
  errors.push(`독음 데이터가 없는 한자: ${[...noReading].join(" ")} (supplement.ts에 추가 필요)`);

// --- 커버리지 ---
const uncovered = KANJI.filter((k) => !COMPOUNDS_BY_KANJI[k.id]?.length);
if (uncovered.length > 0)
  errors.push(`숙어가 하나도 없는 한자: ${uncovered.map((k) => k.id).join(" ")}`);

const thin = KANJI.filter((k) => (COMPOUNDS_BY_KANJI[k.id]?.length ?? 0) < 2);
if (thin.length > 0) warnings.push(`숙어가 1개뿐인 한자: ${thin.map((k) => k.id).join(" ")}`);

// --- 보고 ---
const totalExamples = COMPOUNDS.reduce((n, c) => n + c.examples.length, 0);
console.log(`한자 ${KANJI.length}자 · 숙어 ${COMPOUNDS.length}개 · 예문 ${totalExamples}개`);
console.log(
  `한자당 평균 숙어 ${(
    KANJI.reduce((n, k) => n + (COMPOUNDS_BY_KANJI[k.id]?.length ?? 0), 0) / KANJI.length
  ).toFixed(1)}개`,
);

for (const w of warnings) console.warn(`  경고  ${w}`);
for (const e of errors) console.error(`  오류  ${e}`);

if (errors.length > 0) {
  console.error(`\n오류 ${errors.length}건 — 데이터 수정이 필요합니다.`);
  process.exit(1);
}
console.log(`\n오류 없음 (경고 ${warnings.length}건)`);
