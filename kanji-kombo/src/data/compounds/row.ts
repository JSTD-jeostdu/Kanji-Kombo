import type { JlptLevel } from "../../types";

/**
 * 숙어 데이터 행.
 * [표기, 읽기, 뜻(한), JLPT, 대표한자, 예문[[일본어, 한국어], ...]]
 *
 * 예문의 후리가나는 `漢字[かんじ]` 표기법을 쓴다 — 대괄호 바로 앞의 한자 덩어리에 루비가 붙는다.
 */
export type Row = [string, string, string, JlptLevel, string, [string, string][]];
