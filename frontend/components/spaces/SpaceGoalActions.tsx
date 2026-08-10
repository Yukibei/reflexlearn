"use client";

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

interface SpaceGoalActionsProps {
  title: string;
  onRename: (title: string) => Promise<void>;
  onDelete: () => Promise<void>;
}

export function SpaceGoalActions({ title, onRename, onDelete }: SpaceGoalActionsProps) {
  const [mode, setMode] = useState<"idle" | "edit" | "delete">("idle");
  const [value, setValue] = useState(title);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError("");
    try {
      await action();
      setMode("idle");
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "操作失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  if (mode === "edit") {
    return (
      <div className="mt-5 max-w-2xl rounded-2xl bg-white/55 p-3">
        <div className="flex gap-2">
          <input
            value={value}
            onChange={(event) => setValue(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-[#898989]/20 bg-white/80 px-3 py-2 text-sm outline-none focus:border-[#303030]"
            aria-label="学习目标名称"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void run(() => onRename(value.trim()))}
            disabled={!value.trim() || saving}
            className="rounded-xl bg-[#303030] px-3 text-xs text-white disabled:opacity-40"
          >
            {saving ? "保存中…" : "保存"}
          </button>
          <IconButton label="取消编辑" onClick={() => setMode("idle")} />
        </div>
        {error ? <p className="mt-2 text-xs text-rose-700">{error}</p> : null}
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="mt-5 flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border border-rose-200/70 bg-rose-50/70 p-3">
        <p className="min-w-0 flex-1 text-xs leading-5 text-rose-800">
          删除后，该目标下的路径、资源和任务记录将一并移除，无法恢复。
        </p>
        <button
          type="button"
          onClick={() => void run(onDelete)}
          disabled={saving}
          className="rounded-xl bg-rose-700 px-3 py-2 text-xs text-white disabled:opacity-50"
        >
          {saving ? "删除中…" : "确认删除"}
        </button>
        <button type="button" onClick={() => setMode("idle")} className="px-2 py-2 text-xs text-[#747474]">
          取消
        </button>
        {error ? <p className="w-full text-xs text-rose-700">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="mt-5 flex items-center gap-2">
      <button type="button" onClick={() => setMode("edit")} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/55 px-3 text-xs text-[#303030] hover:bg-white/85">
        <Pencil size={13} aria-hidden /> 编辑目标
      </button>
      <button type="button" onClick={() => setMode("delete")} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs text-[#747474] hover:bg-rose-50 hover:text-rose-700">
        <Trash2 size={13} aria-hidden /> 删除目标
      </button>
    </div>
  );
}

function IconButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[#747474] hover:bg-white">
      <X size={14} aria-hidden />
    </button>
  );
}
