import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { getDb } from "../firebase/client";
import { ROOT_COLLECTION } from "../firebase/env";
import { normalize } from "../store/persist";
import type { AppState } from "../types";

/**
 * 사용자 한 명의 학습 기록 = Firestore 문서 하나 (`kanjiKombo/{uid}`).
 *
 * 카드 한 장에 문서 하나씩 두면 178장 첫 동기화에 178회 쓰기가 나간다.
 * 무료 플랜 할당량을 다른 앱과 나눠 쓰는 상황이라, 읽기 1회·쓰기 1회로 끝나는
 * 단일 문서 구조를 택했다. 일별 집계만 저장하므로 문서는 계속 작게 유지된다.
 */
function stateDoc(uid: string) {
  return doc(getDb(), ROOT_COLLECTION, uid);
}

/** Firestore에 넣을 형태 — undefined가 섞이면 쓰기가 실패하므로 명시적으로 만든다. */
export function serializeState(state: AppState) {
  return {
    version: state.version,
    settings: { ...state.settings },
    cards: state.cards,
    dayHistory: state.dayHistory,
    bonusNewByDay: state.bonusNewByDay,
    lastStudiedDay: state.lastStudiedDay ?? null,
    updatedAt: state.updatedAt,
  };
}

/**
 * 원격 문서를 구독한다.
 *
 * 오프라인 캐시가 켜져 있어 네트워크가 없어도 즉시 캐시본이 흘러나오고,
 * 재접속하면 서버본으로 갱신된다.
 */
export function subscribeRemote(
  uid: string,
  onData: (state: AppState | null, fromCache: boolean) => void,
  onError: (error: unknown) => void,
): () => void {
  return onSnapshot(
    stateDoc(uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null, snapshot.metadata.fromCache);
        return;
      }
      onData(normalize(snapshot.data()), snapshot.metadata.fromCache);
    },
    onError,
  );
}

export async function saveRemote(uid: string, state: AppState): Promise<void> {
  await setDoc(stateDoc(uid), serializeState(state));
}
