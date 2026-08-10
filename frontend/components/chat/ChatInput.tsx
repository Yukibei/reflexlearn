"use client";

import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";

export function ChatInput({
  disabled,
  onSend,
  onStop,
}: {
  disabled: boolean;
  onSend: (msg: string) => void;
  onStop?: () => void;
}) {
  const [value, setValue] = useState("");

  function submit(): void {
    const message = value.trim();
    if (!message || disabled) return;
    onSend(message);
    setValue("");
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-[#898989]/18 bg-white/72 p-1.5 shadow-[0_1px_3px_rgb(48_48_48/0.04),inset_0_1px_0_rgb(255_255_255/0.76)]">
      <textarea
        rows={1}
        className="max-h-28 min-h-9 flex-1 resize-none bg-transparent px-2.5 py-1.5 text-[13px] leading-6 text-[#303030] outline-none placeholder:text-[#898989] disabled:cursor-not-allowed"
        placeholder="描述你的学习目标，或继续追问当前问题..."
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={disabled ? onStop : submit}
        disabled={disabled ? !onStop : !value.trim()}
        aria-label={disabled ? "停止生成" : "发送消息"}
        title={disabled ? "停止生成" : "发送消息"}
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[9px] text-white transition active:scale-95 disabled:cursor-not-allowed disabled:opacity-35 ${disabled ? "bg-[#77621d] hover:bg-[#8b7424]" : "bg-[#303030] hover:bg-[#4a4a4a]"}`}
      >
        {disabled ? <Square size={11} fill="currentColor" aria-hidden /> : <ArrowUp size={17} aria-hidden />}
      </button>
    </div>
  );
}
