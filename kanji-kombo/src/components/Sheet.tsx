import type { ReactNode } from "react";

/** 아래에서 올라오는 모달 시트. 사전 상세·복습 큐가 함께 쓴다. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col bg-ink-950/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="kc-slide mt-auto max-h-[92vh] overflow-y-auto rounded-t-3xl bg-paper"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-ink-900/6 bg-paper/95 px-4 py-3 backdrop-blur">
          <h2 className="truncate text-[14px] font-bold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto shrink-0 rounded-full bg-paper-sunk px-3 py-1.5 text-[12px] font-semibold text-ink-500"
          >
            닫기
          </button>
        </div>
        <div className="mx-auto w-full max-w-lg px-4 pt-4 pb-10">{children}</div>
      </div>
    </div>
  );
}
