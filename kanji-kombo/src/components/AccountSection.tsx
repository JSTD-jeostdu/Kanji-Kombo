import { useState } from "react";
import { useApp } from "../store/appContext";
import type { SyncStatus } from "../store/appContext";
import { Section } from "./ui";

const STATUS_META: Record<SyncStatus, { label: string; tone: string; dot: string }> = {
  off: { label: "로컬 전용", tone: "text-ink-400", dot: "bg-ink-300" },
  "signed-out": { label: "로그인 안 됨", tone: "text-ink-400", dot: "bg-ink-300" },
  connecting: { label: "연결 중", tone: "text-sky-600", dot: "bg-sky-400 animate-pulse" },
  synced: { label: "동기화됨", tone: "text-emerald-600", dot: "bg-emerald-500" },
  offline: { label: "오프라인 (캐시)", tone: "text-amber-600", dot: "bg-amber-500" },
  error: { label: "동기화 오류", tone: "text-rose-600", dot: "bg-rose-500" },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return `${d.getHours()}시 ${String(d.getMinutes()).padStart(2, "0")}분`;
}

/** 계정 · 기기 간 동기화 (PRD 7장) */
export function AccountSection() {
  const { firebaseEnabled, user, syncStatus, syncError, lastSyncedAt, signIn, signOut } = useApp();
  const [busy, setBusy] = useState(false);
  const meta = STATUS_META[syncStatus];

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="계정 · 동기화"
      action={
        <span className={`flex items-center gap-1.5 text-[11px] font-semibold ${meta.tone}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
      }
    >
      {!firebaseEnabled ? (
        <div className="space-y-2">
          <p className="text-[13px] font-semibold text-ink-700">Firebase가 연결되지 않았습니다</p>
          <p className="text-[11.5px] leading-relaxed text-ink-500">
            현재는 이 브라우저에만 기록이 남습니다. <code className="rounded bg-paper-sunk px-1">.env.local</code>
            에 Firebase 웹 앱 설정을 넣고 개발 서버를 다시 띄우면 Google 로그인과 기기 간 동기화가
            켜집니다. 설정 방법은 README의 &ldquo;Firebase 연동&rdquo;을 보세요.
          </p>
        </div>
      ) : user ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full bg-paper-sunk"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[15px] font-bold text-white">
                {(user.displayName ?? user.email ?? "?").slice(0, 1)}
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13.5px] font-bold text-ink-900">
                {user.displayName ?? "이름 없음"}
              </div>
              <div className="truncate text-[11.5px] text-ink-400">{user.email}</div>
            </div>
          </div>

          <dl className="rounded-xl bg-paper/70 px-3 py-2 text-[11.5px]">
            <div className="flex justify-between py-0.5">
              <dt className="text-ink-400">마지막 동기화</dt>
              <dd className="tabular-nums text-ink-700">
                {lastSyncedAt ? formatTime(lastSyncedAt) : "아직 없음"}
              </dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt className="text-ink-400">저장 위치</dt>
              <dd className="text-ink-700">
                kanjiKombo/<span className="text-ink-400">{user.uid.slice(0, 6)}…</span>
              </dd>
            </div>
          </dl>

          <button
            type="button"
            disabled={busy}
            onClick={() => void run(signOut)}
            className="w-full rounded-xl bg-card py-3 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/10 transition active:scale-[0.99] disabled:opacity-50"
          >
            로그아웃
          </button>
          <p className="text-[11px] leading-relaxed text-ink-400">
            로그아웃해도 이 기기의 학습 기록은 지워지지 않습니다.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void run(signIn)}
            className="w-full rounded-xl bg-ink-900 py-3 text-[13px] font-bold text-white transition active:scale-[0.99] disabled:opacity-50"
          >
            {busy ? "로그인 중…" : "Google 계정으로 로그인"}
          </button>
          <p className="text-[11px] leading-relaxed text-ink-400">
            로그인하면 이 기기의 기록과 클라우드 기록이 <strong>카드별로 병합</strong>됩니다. 같은
            카드는 더 최근에 채점한 쪽이 남으므로, 다른 기기에서 한 학습이 사라지지 않습니다.
          </p>
        </div>
      )}

      {syncError && (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-[11.5px] leading-relaxed text-rose-800 ring-1 ring-rose-200">
          {syncError}
        </p>
      )}
    </Section>
  );
}
