import { useRef, useState } from "react";
import { AccountSection } from "../components/AccountSection";
import { Section } from "../components/ui";
import { COMPOUNDS } from "../data/compounds";
import { KANJI } from "../data/kanji";
import { gradeRangeLabel } from "../lib/stats";
import { useApp } from "../store/appContext";

export function Settings() {
  const { state, updateSettings, resetProgress, exportJson, importJson } = useApp();
  const { settings } = state;
  const fileRef = useRef<HTMLInputElement>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 2600);
  };

  const handleExport = () => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kanji-kombo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    flash("학습 기록을 내려받았습니다.");
  };

  const handleImport = async (file: File) => {
    try {
      importJson(await file.text());
      flash("학습 기록을 불러왔습니다.");
    } catch {
      flash("파일을 읽지 못했습니다. 내보내기로 만든 JSON인지 확인해 주세요.");
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 px-4 pt-4 pb-6">
      <AccountSection />

      <Section title="학습량">
        <div className="space-y-5">
          <Slider
            label="하루 신규 카드"
            value={settings.dailyNewGoal}
            min={0}
            max={40}
            step={5}
            suffix="장"
            hint="복습 큐를 다 소화한 뒤에 이 수만큼 새 숙어가 나옵니다."
            onChange={(dailyNewGoal) => updateSettings({ dailyNewGoal })}
          />
          <Slider
            label="하루 복습 상한"
            value={settings.dailyReviewCap}
            min={20}
            max={300}
            step={20}
            suffix="장"
            hint="상한에 걸려도 학습 단계 카드는 계속 나옵니다."
            onChange={(dailyReviewCap) => updateSettings({ dailyReviewCap })}
          />
          <Slider
            label="하루 시작 시각"
            value={settings.dayStartHour}
            min={0}
            max={8}
            step={1}
            suffix="시"
            hint="이 시각 전의 학습은 전날 몫으로 칩니다. 새벽 학습에 유용합니다."
            onChange={(dayStartHour) => updateSettings({ dayStartHour })}
          />
        </div>
      </Section>

      <Section title="카드 표시">
        <div className="divide-y divide-ink-100">
          <Toggle
            label="후리가나 기본값"
            hint="켜 두면 예문의 읽기가 처음부터 보입니다. 학습 중 F 키로 바꿀 수 있습니다."
            checked={settings.furiganaDefault}
            onChange={(furiganaDefault) => updateSettings({ furiganaDefault })}
          />
          <Toggle
            label="한국 한자음 병기"
            hint="한자 풀이에 한국식 음·훈을 함께 보여줍니다."
            checked={settings.showKoreanReading}
            onChange={(showKoreanReading) => updateSettings({ showKoreanReading })}
          />
        </div>
      </Section>

      <Section title="데이터">
        <div className="space-y-2">
          <button
            type="button"
            onClick={handleExport}
            className="w-full rounded-xl bg-ink-900 py-3 text-[13px] font-bold text-white transition active:scale-[0.99]"
          >
            학습 기록 내보내기 (JSON)
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full rounded-xl bg-card py-3 text-[13px] font-bold text-ink-700 ring-1 ring-ink-900/10 transition active:scale-[0.99]"
          >
            학습 기록 불러오기
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImport(file);
              e.target.value = "";
            }}
          />

          {confirmReset ? (
            <div className="rounded-xl bg-rose-50 p-3 ring-1 ring-rose-200">
              <p className="text-[13px] font-semibold text-rose-800">
                모든 학습 기록이 지워집니다. 되돌릴 수 없습니다.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    resetProgress();
                    setConfirmReset(false);
                    flash("학습 기록을 초기화했습니다.");
                  }}
                  className="flex-1 rounded-lg bg-rose-600 py-2 text-[13px] font-bold text-white"
                >
                  초기화
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="flex-1 rounded-lg bg-card py-2 text-[13px] font-bold text-ink-600 ring-1 ring-ink-900/10"
                >
                  취소
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="w-full rounded-xl py-3 text-[13px] font-bold text-rose-600 transition active:scale-[0.99]"
            >
              학습 기록 초기화
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-400">
          학습 기록은 항상 이 브라우저에 먼저 저장되고, 로그인한 경우에만 Firestore로 함께
          올라갑니다. 내보내기 파일은 계정과 무관한 백업으로 쓸 수 있습니다.
        </p>
      </Section>

      <Section title="정보">
        <dl className="space-y-1.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-ink-400">앱</dt>
            <dd className="font-semibold text-ink-800">칸지콤보 漢字コンボ</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">수록 한자</dt>
            <dd className="tabular-nums text-ink-800">
              {gradeRangeLabel()} {KANJI.length}자
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">수록 숙어</dt>
            <dd className="tabular-nums text-ink-800">
              {COMPOUNDS.length}개 · 예문{" "}
              {COMPOUNDS.reduce((n, c) => n + c.examples.length, 0)}개
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-ink-400">복습 알고리즘</dt>
            <dd className="text-ink-800">SM-2 계열</dd>
          </div>
        </dl>
      </Section>

      {notice && (
        <div className="kc-pop fixed inset-x-4 bottom-24 z-40 mx-auto max-w-sm rounded-xl bg-ink-900 px-4 py-3 text-center text-[13px] font-semibold text-white shadow-lg">
          {notice}
        </div>
      )}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  suffix,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  suffix: string;
  hint: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold text-ink-700">{label}</span>
        <span className="text-[13px] font-bold tabular-nums text-ink-900">
          {value}
          {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full accent-[var(--color-vermilion-500)]"
      />
      <p className="mt-1 text-[11px] leading-relaxed text-ink-400">{hint}</p>
    </div>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-3">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-ink-700">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-400">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`mt-0.5 h-6 w-11 shrink-0 rounded-full p-0.5 transition ${
          checked ? "bg-vermilion-500" : "bg-ink-200"
        }`}
      >
        <span
          className={`block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </label>
  );
}
