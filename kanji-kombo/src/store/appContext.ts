import { createContext, useContext } from "react";
import type { SyncUser } from "../firebase/auth";
import type { QueueSnapshot } from "../lib/queue";
import type { AppState, Rating, Settings } from "../types";

/**
 * off        — Firebase 설정이 없어 로컬 전용으로 동작
 * signed-out — 설정은 있으나 로그인하지 않음
 * connecting — 로그인 직후 첫 동기화 대기
 * synced     — 최신 상태
 * offline    — 네트워크가 없어 캐시본으로 동작 중
 * error      — 규칙 거부·네트워크 오류 등
 */
export type SyncStatus = "off" | "signed-out" | "connecting" | "synced" | "offline" | "error";

export interface AppContextValue {
  state: AppState;
  queue: QueueSnapshot;
  now: Date;
  answer: (compoundId: string, rating: Rating) => void;
  undoLast: () => void;
  canUndo: boolean;
  updateSettings: (patch: Partial<Settings>) => void;
  /** 오늘 목표를 다 채운 뒤 신규 카드를 더 하고 싶을 때 */
  addBonusNew: (count: number) => void;
  resetProgress: () => void;
  exportJson: () => string;
  importJson: (json: string) => void;

  // --- 동기화 (로드맵 3단계) ---
  firebaseEnabled: boolean;
  user: SyncUser | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp는 AppProvider 안에서만 쓸 수 있습니다.");
  return ctx;
}
