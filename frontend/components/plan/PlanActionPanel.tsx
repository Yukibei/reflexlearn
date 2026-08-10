import Link from "next/link";
import {
  BookOpenText,
  ClipboardCheck,
  MessageSquareText,
  NotebookPen,
  RotateCcw,
} from "lucide-react";

import { WsCard } from "@/components/workspace";
import type { TodayResourceView, TodayReviewItemView, TodayTaskView } from "@/lib/types";

interface PlanActionPanelProps {
  task: TodayTaskView;
  resources: TodayResourceView[];
  reviews: TodayReviewItemView[];
}

export function PlanActionPanel({ task, resources, reviews }: PlanActionPanelProps) {
  return (
    <aside className="space-y-5">
      <WsCard title="下一步行动" eyebrow="下一步">
        <p className="text-base font-medium text-[var(--ws-ink)]">{task.title}</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{task.reason}</p>
        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-500">
          <span>{task.estimatedMinutes} 分钟</span>
          {task.pathNode ? <span>{task.pathNode}</span> : null}
        </div>
        <div className="mt-5 grid gap-2">
          <ActionLink href="/chat" label="让 AI 导师调整路径" icon={MessageSquareText} primary />
          <ActionLink href="/mistakes" label="从错题生成补救路径" icon={NotebookPen} />
          <ActionLink href="/resources" label="查看关联资源" icon={BookOpenText} />
          <ActionLink href="/today" label="回到今日学习" icon={RotateCcw} />
        </div>
      </WsCard>

      <WsCard title="关联资源" eyebrow="资源">
        <div className="space-y-4 pr-1">
          {resources.slice(0, 4).map((resource) => (
            <article key={resource.id} className="border-b border-[var(--ws-line)] pb-4 last:border-0 last:pb-0">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BookOpenText size={14} className="text-slate-400" aria-hidden />
                <span>{resource.sourceLabel}</span>
                <span>{resource.estimatedMinutes} 分钟</span>
              </div>
              <h4 className="mt-1.5 text-sm font-medium text-[var(--ws-ink)]">
                {resource.title}
              </h4>
              <p className="mt-1 text-xs leading-5 text-slate-600">{resource.reason}</p>
            </article>
          ))}
        </div>
      </WsCard>

      <WsCard title="复习提醒" eyebrow="复习">
        {reviews.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">当前没有需要插入路径的复习项。</p>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 3).map((item) => (
              <div key={`${item.topic}-${item.dueLabel}`} className="flex gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center bg-amber-50 text-amber-700">
                  <ClipboardCheck size={14} aria-hidden />
                </span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-[var(--ws-ink)]">{item.topic}</p>
                    <span className="text-xs text-slate-500">{item.dueLabel}</span>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.reason}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </WsCard>
    </aside>
  );
}

function ActionLink({
  href,
  label,
  icon: Icon,
  primary = false,
}: {
  href: string;
  label: string;
  icon: typeof MessageSquareText;
  primary?: boolean;
}) {
  const className = primary
    ? "rounded-full bg-[#ffd85f] text-[#303030] hover:bg-[#ffe38b]"
    : "rounded-full border border-[#898989]/20 bg-white/65 text-[#303030] hover:bg-white";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 text-sm font-medium transition-colors ${className}`}
    >
      <Icon size={15} aria-hidden />
      {label}
    </Link>
  );
}
