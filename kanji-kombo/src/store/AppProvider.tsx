import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AppContext, type AppContextValue } from "./appContext";
import { buildQueue } from "../lib/queue";
import { toDayKey } from "../lib/date";
import { applyRating, createCard } from "../lib/srs";
import type { AppState, Rating, Settings } from "../types";
import { useSync } from "../sync/useSync";
import { emptyState, exportState, importState, loadState, saveState } from "./persist";

/** 학습 단계 카드가 시간이 되면 저절로 큐에 나타나도록 하는 갱신 주기 */
const TICK_MS = 10000;

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => loadState());
  const [now, setNow] = useState(() => new Date());
  const undoStack = useRef<AppState[]>([]);
  const [canUndo, setCanUndo] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") setNow(new Date());
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const answer = useCallback((compoundId: string, rating: Rating) => {
    setState((prev) => {
      undoStack.current = [prev];
      const at = new Date();
      const day = toDayKey(at, prev.settings.dayStartHour);
      const existing = prev.cards[compoundId];
      const card = existing ?? createCard(compoundId, at);
      const updated = applyRating(card, rating, at);

      const before = prev.dayHistory[day] ?? { reviews: 0, fromNew: 0, again: 0 };
      const stat = {
        reviews: before.reviews + 1,
        fromNew: before.fromNew + (existing ? 0 : 1),
        again: before.again + (rating === "again" ? 1 : 0),
      };

      return {
        ...prev,
        cards: { ...prev.cards, [compoundId]: updated },
        dayHistory: { ...prev.dayHistory, [day]: stat },
        lastStudiedDay: day,
        updatedAt: at.toISOString(),
      };
    });
    setCanUndo(true);
    setNow(new Date());
  }, []);

  const undoLast = useCallback(() => {
    const prev = undoStack.current.pop();
    if (!prev) return;
    setState(prev);
    setCanUndo(false);
  }, []);

  const updateSettings = useCallback((patch: Partial<Settings>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...patch },
      updatedAt: new Date().toISOString(),
    }));
  }, []);

  const addBonusNew = useCallback((count: number) => {
    setState((prev) => {
      const day = toDayKey(new Date(), prev.settings.dayStartHour);
      return {
        ...prev,
        bonusNewByDay: { ...prev.bonusNewByDay, [day]: (prev.bonusNewByDay[day] ?? 0) + count },
        updatedAt: new Date().toISOString(),
      };
    });
    setNow(new Date());
  }, []);

  const resetProgress = useCallback(() => {
    setState((prev) => ({ ...emptyState(), settings: prev.settings }));
    undoStack.current = [];
    setCanUndo(false);
  }, []);

  const importJson = useCallback((json: string) => {
    setState(importState(json));
    undoStack.current = [];
    setCanUndo(false);
  }, []);

  const sync = useSync(state, setState);

  const queue = useMemo(() => buildQueue(state, now), [state, now]);

  const value = useMemo<AppContextValue>(
    () => ({
      state,
      queue,
      now,
      answer,
      undoLast,
      canUndo,
      updateSettings,
      addBonusNew,
      resetProgress,
      exportJson: () => exportState(state),
      importJson,
      ...sync,
    }),
    [
      state,
      queue,
      now,
      answer,
      undoLast,
      canUndo,
      updateSettings,
      addBonusNew,
      resetProgress,
      importJson,
      sync,
    ],
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

