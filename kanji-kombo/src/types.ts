export type JlptLevel = "N5" | "N4" | "N3" | "N2" | "N1";

/** 교육한자 낱자. 정적 데이터(PRD 5장 `Kanji`). */
export interface Kanji {
  /** 한자 자체를 id로 쓴다. 유니크하고 참조가 읽기 쉽다. */
  id: string;
  strokes: number;
  /** 교육한자 학년 (1~6) */
  grade: number;
  jlpt: JlptLevel;
  /** 음독 (가타카나) */
  on: string[];
  /** 훈독 (히라가나, 送り仮名는 . 뒤에) */
  kun: string[];
  /** 한국 한자음 — krHun과 같은 순서로 짝을 이룬다. 예: 매 ↔ 매양 */
  krEum: string[];
  krHun: string[];
  /** 한국어 대표 뜻 요약 */
  meaningKo: string;
}

/** 후리가나 표기법: `漢字[かんじ]` — 대괄호 앞 한자 덩어리에 루비를 붙인다. */
export interface ExampleSentence {
  jp: string;
  ko: string;
}

/** 학습의 기본 단위인 숙어 카드(PRD 3.2 `Compound`). */
export interface Compound {
  /** 표기 자체를 id로 쓴다. */
  id: string;
  /** 읽기 (히라가나) */
  reading: string;
  meaningKo: string;
  jlpt: JlptLevel;
  /** 이 숙어에 포함된 교육한자 id 목록 (커버리지 계산에 쓰인다) */
  kanjiIds: string[];
  /** 진도 순서를 정하는 데 쓰는 대표 한자 */
  primaryKanji: string;
  examples: ExampleSentence[];
}

export type Rating = "again" | "hard" | "good" | "easy";

export type CardStage = "new" | "learning" | "review" | "mature";

/** SRS 상태(PRD 5장 `UserCard`). localStorage에 저장한다. */
export interface UserCard {
  compoundId: string;
  stage: CardStage;
  /** SM-2 이지팩터 */
  ease: number;
  /** 복습 간격(일) */
  interval: number;
  /** 학습 단계(learning) 내 위치 */
  step: number;
  /** ISO 8601 */
  dueAt: string;
  reps: number;
  lapses: number;
  lastReviewedAt: string | null;
  introducedAt: string;
}

/**
 * 하루치 채점 집계.
 *
 * 원시 채점 로그 대신 이 집계만 남긴다. 통계에 필요한 값이 모두 여기서 나오고,
 * 무엇보다 Firestore 문서 하나(1MiB 한도)에 평생 기록을 담을 수 있을 만큼 작다.
 * (하루 40바이트 남짓 → 10년치가 150KB 수준)
 */
export interface DayStat {
  /** 그날의 총 채점 횟수 */
  reviews: number;
  /** 그중 신규 카드를 처음 꺼낸 횟수 = 그날 도입한 신규 카드 수 */
  fromNew: number;
  /** 그중 '다시'를 누른 횟수 */
  again: number;
}

export interface Settings {
  dailyNewGoal: number;
  dailyReviewCap: number;
  furiganaDefault: boolean;
  /** 하루의 시작 시각(0~23). 새벽 학습을 전날로 칠 수 있게 한다. */
  dayStartHour: number;
  showKoreanReading: boolean;
}

export interface AppState {
  version: number;
  settings: Settings;
  cards: Record<string, UserCard>;
  /** YYYY-MM-DD -> 그날의 채점 집계 */
  dayHistory: Record<string, DayStat>;
  /** YYYY-MM-DD -> 그날 목표치에 더 얹은 추가 신규 카드 수 */
  bonusNewByDay: Record<string, number>;
  lastStudiedDay: string | null;
  /** 마지막 변경 시각(ISO) — 기기 간 병합에서 설정값 우선순위를 정하는 데 쓴다 */
  updatedAt: string;
}
