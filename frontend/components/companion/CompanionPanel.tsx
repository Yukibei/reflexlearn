"use client";

import { Send, X } from "lucide-react";

import type { CompanionStatus } from "./companionState";
import { STATUS_LABEL } from "./companionState";
import { CompanionThinking } from "./CompanionThinking";

export interface CompanionTurn {
  role: "user" | "companion";
  text: string;
  degraded?: boolean;
}

interface CompanionPanelProps {
  pageName: string;
  status: CompanionStatus;
  turns: CompanionTurn[];
  busy: boolean;
  input: string;
  onInputChange: (value: string) => void;
  onAsk: () => void;
  onClose: () => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function CompanionPanel({
  pageName,
  status,
  turns,
  busy,
  input,
  onInputChange,
  onAsk,
  onClose,
  listRef,
}: CompanionPanelProps) {
  return (
    <div className="fixed bottom-28 right-4 z-50 flex h-[460px] w-[min(92vw,360px)] flex-col overflow-hidden rounded-[24px] border border-white/70 bg-white/70 shadow-[0_16px_44px_rgb(48_48_48/0.16)] backdrop-blur-3xl sm:right-6">
      <header className="border-b border-[#898989]/15 bg-white/35 px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-[var(--ws-ink)]">AI 学伴 · 随身导师</span>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-[rgb(5_26_36/0.06)] hover:text-[var(--ws-ink)]"
            aria-label="收起学伴辅导框"
          >
            <X size={15} aria-hidden />
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          正在陪你看：{pageName} · {STATUS_LABEL[status]}
        </p>
      </header>

      <div ref={listRef} className="ws-scroll flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {turns.length === 0 ? (
          <div className="rounded-xl bg-[rgb(5_26_36/0.04)] px-3.5 py-3 text-sm leading-relaxed text-slate-600">
            学习中遇到卡点随时问我：概念解释、题目思路、代码报错都可以。
            我会结合你的画像和当前页面给针对性解答。
          </div>
        ) : (
          turns.map((turn, index) => (
            <div
              key={index}
              className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                turn.role === "user"
                  ? "ml-auto bg-[var(--ws-ink)] text-white"
                  : "bg-[rgb(5_26_36/0.04)] text-slate-700"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{turn.text}</p>
              {turn.degraded ? (
                <p className="mt-1 text-[11px] text-amber-600">离线降级回答</p>
              ) : null}
            </div>
          ))
        )}
        {busy ? <CompanionThinking /> : null}
      </div>

      <div className="flex items-end gap-2 border-t border-[#898989]/15 bg-white/45 p-3">
        <textarea
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onAsk();
            }
          }}
          rows={1}
          placeholder="例如：为什么我的梯度下降不收敛？"
          className="max-h-24 min-w-0 flex-1 resize-none rounded-2xl border border-[#898989]/20 bg-white/70 px-3 py-2 text-sm text-[#303030] outline-none placeholder:text-[#898989] focus:border-[#ffd85f]"
        />
        <button
          type="button"
          onClick={onAsk}
          disabled={busy || !input.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#ffd85f] text-[#303030] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          aria-label="发送问题"
        >
          <Send size={15} aria-hidden />
        </button>
      </div>
    </div>
  );
}
