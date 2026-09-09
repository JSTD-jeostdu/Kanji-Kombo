/**
 * 손글씨 워크시트(.docx) 생성기.  `npm run build:worksheet`
 *
 * scripts/export-worksheet.ts 가 만든 worksheet/data.json을 읽어
 * 교육한자 20자씩 4개의 워드 파일로 조판한다.
 *
 * 구성 (한자 1자 = 새 쪽에서 시작)
 *   한자 머리표(음훈·획수·급수)  →  숙어마다:
 *     숙어 · 읽기 · 뜻  →  글자별 한·일 독음  →  10칸 쓰기(앞 2회 덧쓰기 견본)
 *     →  예문마다 원문·읽기·해석 + 베껴 쓰는 줄 2개
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  HeightRule,
  VerticalAlign,
  PageBreak,
  Header,
  Footer,
  PageNumber,
} from "docx";

// ── 지면 ───────────────────────────────────────────────────────────
const PAGE = { width: 11906, height: 16838 }; // A4 세로 (twip)
const MARGIN = { top: 900, right: 1134, bottom: 800, left: 1134, header: 450, footer: 350 };
const USABLE = PAGE.width - MARGIN.left - MARGIN.right; // 9638

// ── 글꼴 ───────────────────────────────────────────────────────────
// 이 PC에 설치된 일본어 글꼴을 확인해 고른 값이다. 한자를 일본식 자형으로
// 찍으려면 반드시 일본어 글꼴이어야 한다 (한글 글꼴은 자형이 미묘하게 다르다).
const JP = { ascii: "Yu Gothic", eastAsia: "Yu Gothic", hAnsi: "Yu Gothic" };
const KR = { ascii: "Malgun Gothic", eastAsia: "Malgun Gothic", hAnsi: "Malgun Gothic" };

const INK = "1A1A1A";
const MUTED = "6E6E6E";
const FAINT = "9A9A9A";
const MODEL = "C0C0C0"; // 덧쓰기 견본 회색
const RULE = "BFBFBF";
const GRID = "8C8C8C";
const GRID_STRONG = "3F3F3F";

const jp = (text, opts = {}) => new TextRun({ text, font: JP, color: INK, ...opts });
const kr = (text, opts = {}) => new TextRun({ text, font: KR, color: INK, ...opts });

const NO_BORDER = {
  top: { style: BorderStyle.NONE },
  bottom: { style: BorderStyle.NONE },
  left: { style: BorderStyle.NONE },
  right: { style: BorderStyle.NONE },
};

// ── 쓰기 칸 배치 ────────────────────────────────────────────────────
// 글자 수에 따라 한 줄에 몇 번씩 반복할지 정한다. 칸이 너무 작아지면
// 손으로 쓸 수 없으므로, 긴 숙어는 한 줄 반복 수를 줄인다.
function gridConfig(len) {
  if (len <= 1) return { perRow: 10, rows: 1 };
  if (len === 2) return { perRow: 5, rows: 2 };
  // 3자를 한 줄에 5번 넣으면 칸이 1.1cm까지 줄어 손으로 쓰기 답답하다.
  // 한 줄 4번으로 줄여 1.4cm를 확보한다 (12칸 = 10회 + 여유 2회).
  if (len === 3) return { perRow: 4, rows: 3 };
  return { perRow: 3, rows: 4 }; // 4자 — 12칸(10회 + 여유 2회)
}

function practiceTable(word) {
  const chars = [...word];
  const len = chars.length;
  const { perRow, rows } = gridConfig(len);
  const cols = perRow * len;
  const cell = Math.floor(USABLE / cols);
  const fontHalf = Math.max(22, Math.round(cell / 20)); // 칸 크기에 맞춘 글자 크기

  const tableRows = [];
  for (let r = 0; r < rows; r += 1) {
    const cells = [];
    for (let c = 0; c < cols; c += 1) {
      const repIndex = r * perRow + Math.floor(c / len);
      const posInRep = c % len;
      const isModel = repIndex < 2; // 앞 2회는 덧쓰기 견본
      const isRepEnd = posInRep === len - 1;

      cells.push(
        new TableCell({
          width: { size: cell, type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: GRID },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: GRID },
            left: {
              style: BorderStyle.SINGLE,
              size: posInRep === 0 ? 10 : 4,
              color: posInRep === 0 ? GRID_STRONG : GRID,
            },
            right: {
              style: BorderStyle.SINGLE,
              size: isRepEnd ? 10 : 4,
              color: isRepEnd ? GRID_STRONG : GRID,
            },
          },
          children: [
            // 행 높이(EXACT)와 셀의 세로 가운데 정렬이 위치를 잡는다.
            // 여기서 line/lineRule을 함께 주면 글자가 줄 상자 아래쪽에 붙어 버린다.
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: isModel
                ? [jp(chars[posInRep], { size: fontHalf, color: MODEL })]
                : [new TextRun({ text: "", size: fontHalf })],
            }),
          ],
        }),
      );
    }
    tableRows.push(new TableRow({ children: cells, height: { value: cell, rule: HeightRule.EXACT }, cantSplit: true }));
  }

  return new Table({
    columnWidths: Array(cols).fill(cell),
    width: { size: cell * cols, type: WidthType.DXA },
    rows: tableRows,
  });
}

// ── 조각들 ─────────────────────────────────────────────────────────
function writingLine() {
  return new Paragraph({
    spacing: { before: 460, after: 0 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: RULE, space: 1 } },
    children: [new TextRun({ text: "", size: 20 })],
  });
}

function kanjiHeader(k) {
  const bigCell = 1500;
  const infoCell = USABLE - bigCell;

  const info = [
    new Paragraph({
      spacing: { before: 40, after: 30 },
      children: [
        kr("음독 ", { size: 17, color: MUTED, bold: true }),
        jp(k.on.join("・") || "—", { size: 21 }),
        kr("      훈독 ", { size: 17, color: MUTED, bold: true }),
        jp(k.kun.join("・") || "—", { size: 21 }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 30 },
      children: [
        kr("한국 음훈 ", { size: 17, color: MUTED, bold: true }),
        kr(k.krHun.map((h, i) => `${h} ${k.krEum[i] ?? ""}`).join(" · "), { size: 21, bold: true }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 0 },
      children: [
        kr(`${k.strokes}획 · ${k.jlpt} · 교육 ${k.grade}학년 · 뜻: ${k.meaningKo}`, {
          size: 17,
          color: MUTED,
        }),
      ],
    }),
  ];

  return new Table({
    columnWidths: [bigCell, infoCell],
    width: { size: USABLE, type: WidthType.DXA },
    rows: [
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: bigCell, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: INK },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: INK },
              left: { style: BorderStyle.SINGLE, size: 12, color: INK },
              right: { style: BorderStyle.SINGLE, size: 6, color: GRID },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 60, after: 60 },
                children: [jp(k.char, { size: 92 })],
              }),
            ],
          }),
          new TableCell({
            width: { size: infoCell, type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            margins: { left: 220, right: 120, top: 80, bottom: 80 },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 12, color: INK },
              bottom: { style: BorderStyle.SINGLE, size: 12, color: INK },
              left: { style: BorderStyle.SINGLE, size: 6, color: GRID },
              right: { style: BorderStyle.SINGLE, size: 12, color: INK },
            },
            children: info,
          }),
        ],
      }),
    ],
  });
}

function compoundBlock(c) {
  const out = [];

  // 숙어 · 읽기 · 뜻
  out.push(
    new Paragraph({
      keepNext: true,
      spacing: { before: 320, after: 80 },
      children: [
        jp(c.word, { size: 30, bold: true }),
        jp(`　${c.reading}`, { size: 20, color: MUTED }),
        kr(`　—　${c.meaningKo}`, { size: 21, bold: true }),
        kr(`　（${c.jlpt}）`, { size: 16, color: FAINT }),
      ],
    }),
  );

  // 글자별 한·일 독음
  for (const ch of c.chars) {
    out.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 0, after: 20 },
        indent: { left: 180 },
        children: [
          jp(ch.char, { size: 22, bold: true }),
          kr("　音 ", { size: 15, color: FAINT }),
          jp(ch.on.join("・") || "—", { size: 17, color: MUTED }),
          kr("　訓 ", { size: 15, color: FAINT }),
          jp(ch.kun.join("・") || "—", { size: 17, color: MUTED }),
          kr("　│　", { size: 15, color: FAINT }),
          kr(ch.krHun.map((h, i) => `${h} ${ch.krEum[i] ?? ""}`).join(" · "), {
            size: 17,
            color: MUTED,
          }),
          ...(ch.inCurriculum ? [] : [kr("　(배당표 밖)", { size: 13, color: FAINT })]),
        ],
      }),
    );
  }

  out.push(new Paragraph({ spacing: { before: 60, after: 0 }, children: [] }));
  out.push(practiceTable(c.word));

  // 예문
  c.examples.forEach((ex, i) => {
    out.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 260, after: 20 },
        children: [
          kr(`예문 ${i + 1}　`, { size: 16, color: MUTED, bold: true }),
          jp(ex.jp, { size: 21 }),
        ],
      }),
    );
    out.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 0, after: 20 },
        indent: { left: 620 },
        children: [jp(ex.kana, { size: 16, color: MUTED })],
      }),
    );
    out.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 0, after: 40 },
        indent: { left: 620 },
        children: [kr(ex.ko, { size: 17, color: MUTED })],
      }),
    );
    out.push(writingLine());
    out.push(writingLine());
  });

  return out;
}

function introBlock(part, range) {
  return [
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [kr("칸지콤보 손글씨 워크시트", { size: 34, bold: true })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 200 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: INK, space: 6 } },
      children: [
        kr(`교육한자 1학년 · ${part}번째 묶음 (${range})`, { size: 20, color: MUTED }),
      ],
    }),
    new Paragraph({
      spacing: { before: 0, after: 60 },
      children: [kr("쓰는 순서", { size: 19, bold: true })],
    }),
    ...[
      "① 맨 위 상자에서 한자의 음독·훈독과 한국 음훈을 소리 내어 읽습니다.",
      "② 회색으로 찍힌 앞 두 칸을 따라 덧쓰고, 나머지 칸은 보지 않고 씁니다.",
      "③ 예문을 읽은 뒤 아래 두 줄에 그대로 옮겨 적습니다.",
      "④ 연습칸에는 읽는 법을 적어 두지 않았습니다. 쓰면서 스스로 떠올려 보세요.",
    ].map(
      (t) =>
        new Paragraph({
          spacing: { before: 0, after: 40 },
          indent: { left: 160 },
          children: [kr(t, { size: 18, color: MUTED })],
        }),
    ),
    new Paragraph({
      spacing: { before: 160, after: 300 },
      children: [
        kr("한자 한 자가 한 쪽에서 시작합니다. 오늘 할 한자의 쪽만 골라 인쇄하셔도 됩니다.", {
          size: 16,
          color: FAINT,
        }),
      ],
    }),
  ];
}

// ── 파일 만들기 ────────────────────────────────────────────────────
function buildPart(kanjiList, part) {
  const range = `${kanjiList[0].char} ~ ${kanjiList[kanjiList.length - 1].char}`;
  const children = [...introBlock(part, range)];

  kanjiList.forEach((k, idx) => {
    if (idx > 0) children.push(new Paragraph({ children: [new PageBreak()] }));

    children.push(
      new Paragraph({
        spacing: { before: 0, after: 60 },
        children: [
          kr(`${String(k.index).padStart(2, "0")}`, { size: 20, bold: true, color: MUTED }),
          kr("　　　　　　　　　　　　　　　　　　　　　　　　　　날짜 ______ · 확인 ______", {
            size: 15,
            color: FAINT,
          }),
        ],
      }),
    );
    children.push(kanjiHeader(k));
    for (const c of k.compounds) children.push(...compoundBlock(c));
  });

  return new Document({
    creator: "칸지콤보",
    title: `칸지콤보 워크시트 ${part} (${range})`,
    description: "교육한자 1학년 손글씨 연습 학습지",
    styles: {
      default: {
        document: { run: { font: KR, size: 20, color: INK } },
      },
    },
    sections: [
      {
        properties: { page: { size: PAGE, margin: MARGIN } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { after: 0 },
                children: [
                  kr(`칸지콤보 워크시트 · 교육한자 1학년 · ${part}/4 (${range})`, {
                    size: 15,
                    color: FAINT,
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ children: [PageNumber.CURRENT], font: KR, size: 16, color: FAINT }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
}

// ── 실행 ───────────────────────────────────────────────────────────
const data = JSON.parse(readFileSync("worksheet/data.json", "utf8"));
mkdirSync("worksheet", { recursive: true });

const CHUNK = 20;
for (let i = 0; i < data.length; i += CHUNK) {
  const part = i / CHUNK + 1;
  const slice = data.slice(i, i + CHUNK);
  const doc = buildPart(slice, part);
  const buffer = await Packer.toBuffer(doc);
  const name = `worksheet/칸지콤보_워크시트_${part}_${slice[0].char}-${slice[slice.length - 1].char}.docx`;
  writeFileSync(name, buffer);
  const compounds = slice.reduce((n, k) => n + k.compounds.length, 0);
  console.log(`${name}  (한자 ${slice.length}자 · 숙어 ${compounds}개)`);
}
console.log("완료");
