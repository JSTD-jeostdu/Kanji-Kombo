export type Tab = "study" | "browse" | "stats" | "settings";

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "study", label: "학습", icon: "字" },
  { id: "browse", label: "사전", icon: "書" },
  { id: "stats", label: "통계", icon: "統" },
  { id: "settings", label: "설정", icon: "設" },
];

export function BottomNav({
  tab,
  onChange,
  badge,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
  badge: number;
}) {
  return (
    <nav className="z-20 shrink-0 border-t border-ink-900/8 bg-card/95 backdrop-blur">
      <ul className="mx-auto flex max-w-lg">
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <li key={t.id} className="flex-1">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                className={`relative flex w-full flex-col items-center gap-0.5 py-2.5 transition ${
                  active ? "text-ink-900" : "text-ink-400"
                }`}
              >
                <span
                  className={`jp-serif flex h-7 w-7 items-center justify-center rounded-lg text-[15px] font-bold transition ${
                    active ? "bg-ink-900 text-white" : "bg-transparent"
                  }`}
                >
                  {t.icon}
                </span>
                <span className="text-[11px] font-semibold">{t.label}</span>
                {t.id === "study" && badge > 0 && (
                  <span className="absolute top-1.5 right-[calc(50%-1.6rem)] min-w-4 rounded-full bg-vermilion-500 px-1 text-[10px] font-bold text-white tabular-nums">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      <div style={{ height: "var(--safe-b)" }} />
    </nav>
  );
}
