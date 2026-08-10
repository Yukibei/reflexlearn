"use client";

import { useState } from "react";
import { BookOpen, CheckCircle2, CircleDashed, RotateCcw } from "lucide-react";

import { updateResourceStatus, type StudyStatus } from "@/lib/resourceDetailApi";

const STATUS_FLOW: Array<{
  value: StudyStatus;
  label: string;
  icon: typeof BookOpen;
}> = [
  { value: "unread", label: "未开始", icon: CircleDashed },
  { value: "in_progress", label: "学习中", icon: BookOpen },
  { value: "done", label: "已完成", icon: CheckCircle2 },
  { value: "reviewed", label: "已复盘", icon: RotateCcw },
];

interface ResourceStudyActionsProps {
  token: string;
  resourceId: string;
  status: StudyStatus;
  onChanged?: (status: StudyStatus) => void;
}

/* 学习状态回写：行为回流的最小入口。点选即保存，失败回滚并提示重试。 */
export function ResourceStudyActions({
  token,
  resourceId,
  status,
  onChanged,
}: ResourceStudyActionsProps) {
  const [pending, setPending] = useState<StudyStatus | null>(null);
  const [failed, setFailed] = useState(false);

  const change = async (next: StudyStatus) => {
    if (next === status || pending) return;
    setPending(next);
    setFailed(false);
    try {
      await updateResourceStatus(token, resourceId, next);
      onChanged?.(next);
    } catch {
      setFailed(true);
    } finally {
      setPending(null);
    }
  };

  return (
    <div>
      <p className="text-xs text-slate-500">学习状态（点选即保存，会进入成长档案统计）</p>
      <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="学习状态">
        {STATUS_FLOW.map((item) => {
          const Icon = item.icon;
          const active = item.value === status;
          const saving = pending === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => change(item.value)}
              disabled={pending !== null}
              aria-pressed={active}
              className={`inline-flex items-center gap-1.5 border px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
                active
                  ? "rounded-full border-[#303030] bg-[#303030] text-white"
                  : "rounded-full border-[#898989]/20 bg-white/65 text-[#747474] hover:bg-white hover:text-[#303030]"
              }`}
            >
              <Icon size={14} aria-hidden />
              {saving ? "保存中…" : item.label}
            </button>
          );
        })}
      </div>
      {failed ? (
        <p className="mt-2 text-xs text-amber-700" role="status">
          状态保存失败，请稍后重试。
        </p>
      ) : null}
    </div>
  );
}
