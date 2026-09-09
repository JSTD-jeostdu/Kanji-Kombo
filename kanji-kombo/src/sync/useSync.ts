import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { firebaseEnabled } from "../firebase/env";
import type { SyncUser } from "../firebase/auth";
import type { SyncStatus } from "../store/appContext";
import type { AppState } from "../types";
import { mergeStates, sameState, stableStringify } from "./merge";

/** 연달아 채점할 때 매번 쓰지 않도록 묶는 시간 */
const PUSH_DEBOUNCE_MS = 1200;

export interface SyncApi {
  firebaseEnabled: boolean;
  user: SyncUser | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

function describe(error: unknown): string {
  const code = (error as { code?: string } | null)?.code ?? "";
  if (code === "permission-denied")
    return "Firestore 보안 규칙이 접근을 거부했습니다. kanjiKombo 규칙이 반영됐는지 확인해 주세요.";
  if (code === "auth/popup-blocked") return "브라우저가 팝업을 막았습니다. 팝업을 허용해 주세요.";
  if (code === "auth/popup-closed-by-user") return "로그인 창이 닫혔습니다.";
  if (code === "auth/unauthorized-domain")
    return "이 도메인이 Firebase Authentication의 승인된 도메인 목록에 없습니다.";
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Firebase 로그인 + Firestore 양방향 동기화.
 *
 * Firebase 관련 모듈은 동적 import로 가져온다. 설정이 없으면 아예 내려받지 않으므로
 * 로컬 전용으로 쓸 때 번들이 무거워지지 않는다.
 */
export function useSync(
  state: AppState,
  setState: Dispatch<SetStateAction<AppState>>,
): SyncApi {
  const [user, setUser] = useState<SyncUser | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    firebaseEnabled ? "signed-out" : "off",
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  /** 방금 올린 내용 — 같은 내용을 반복해서 쓰지 않기 위한 표식 */
  const lastPushed = useRef<string | null>(null);

  // 1) 로그인 상태 구독
  useEffect(() => {
    if (!firebaseEnabled) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void import("../firebase/auth").then(({ observeAuth }) => {
      if (cancelled) return;
      unsubscribe = observeAuth((next) => {
        setUser(next);
        setSyncStatus(next ? "connecting" : "signed-out");
        if (!next) lastPushed.current = null;
      });
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);

  // 2) 원격 문서 구독 → 로컬과 병합
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    void import("./remote").then(({ subscribeRemote }) => {
      if (cancelled) return;
      unsubscribe = subscribeRemote(
        user.uid,
        (remote, fromCache) => {
          if (remote) {
            setState((prev) => {
              const merged = mergeStates(prev, remote);
              return sameState(prev, merged) ? prev : merged;
            });
          }
          setSyncError(null);
          setSyncStatus(fromCache ? "offline" : "synced");
          if (!fromCache) setLastSyncedAt(new Date().toISOString());
        },
        (error) => {
          setSyncError(describe(error));
          setSyncStatus("error");
        },
      );
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [user, setState]);

  // 3) 로컬 변경 → 원격 반영 (디바운스)
  useEffect(() => {
    if (!firebaseEnabled || !user) return;
    const payload = stableStringify(state);
    if (lastPushed.current === payload) return;

    const timer = window.setTimeout(() => {
      void import("./remote").then(async ({ saveRemote }) => {
        try {
          await saveRemote(user.uid, state);
          lastPushed.current = payload;
          setLastSyncedAt(new Date().toISOString());
          setSyncError(null);
          setSyncStatus((prev) => (prev === "error" ? "synced" : prev));
        } catch (error) {
          setSyncError(describe(error));
          setSyncStatus("error");
        }
      });
    }, PUSH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [state, user]);

  const signIn = useCallback(async () => {
    setSyncError(null);
    try {
      const { signInWithGoogle } = await import("../firebase/auth");
      await signInWithGoogle();
    } catch (error) {
      setSyncError(describe(error));
      setSyncStatus("error");
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      const { signOutUser } = await import("../firebase/auth");
      await signOutUser();
      lastPushed.current = null;
      setLastSyncedAt(null);
    } catch (error) {
      setSyncError(describe(error));
    }
  }, []);

  return { firebaseEnabled, user, syncStatus, syncError, lastSyncedAt, signIn, signOut };
}
