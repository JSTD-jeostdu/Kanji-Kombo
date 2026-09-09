import { useEffect, useMemo, useState } from "react";
import { BottomNav, type Tab } from "./components/BottomNav";
import { Browse } from "./pages/Browse";
import { Settings } from "./pages/Settings";
import { Stats } from "./pages/Stats";
import { Study } from "./pages/Study";
import { summarize } from "./lib/stats";
import { AppProvider } from "./store/AppProvider";
import { useApp } from "./store/appContext";

const TABS: Tab[] = ["study", "browse", "stats", "settings"];

function tabFromHash(): Tab {
  const raw = window.location.hash.replace(/^#\/?/, "") as Tab;
  return TABS.includes(raw) ? raw : "study";
}

const TITLES: Record<Tab, string> = {
  study: "학습",
  browse: "한자 · 숙어 사전",
  stats: "통계",
  settings: "설정",
};

function Shell() {
  const { state, queue, now, syncStatus } = useApp();
  const [tab, setTab] = useState<Tab>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Tab) => {
    window.location.hash = `/${next}`;
    setTab(next);
  };

  const streak = useMemo(() => summarize(state, now).streak, [state, now]);
  const badge = queue.dueNow.length + queue.newRemaining;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="z-20 shrink-0 border-b border-ink-900/6 bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <span className="jp-serif flex h-8 w-8 items-center justify-center rounded-lg bg-vermilion-500 text-[17px] font-black text-white">
            漢
          </span>
          <div className="min-w-0">
            <h1 className="text-[15px] leading-tight font-extrabold text-ink-900">칸지콤보</h1>
            <p className="text-[11px] leading-tight text-ink-400">{TITLES[tab]}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {/* 동기화가 정상일 때는 굳이 알리지 않는다 — 문제가 있을 때만 보인다 */}
            {(syncStatus === "offline" || syncStatus === "error") && (
              <button
                type="button"
                onClick={() => go("settings")}
                className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                  syncStatus === "error"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-amber-100 text-amber-700"
                }`}
              >
                {syncStatus === "error" ? "동기화 오류" : "오프라인"}
              </button>
            )}
            {streak > 0 && (
              <span className="rounded-full bg-vermilion-500/12 px-2.5 py-1 text-[12px] font-bold text-vermilion-600 tabular-nums">
                {streak}일 연속
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col overflow-y-auto overscroll-contain">
        {tab === "study" && <Study />}
        {tab === "browse" && <Browse />}
        {tab === "stats" && <Stats />}
        {tab === "settings" && <Settings />}
      </main>

      <BottomNav tab={tab} onChange={go} badge={badge} />
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
