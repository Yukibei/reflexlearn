import { AlertTriangle, BookOpenText, CheckCircle2, Clock3, GitBranch, NotebookPen } from "lucide-react";

import { Tag, WsCard } from "@/components/workspace";
import { MasteryLedger } from "@/components/growth/GrowthTrendChart";
import type {
  CollaborationTraceEvent,
  ProfileSummary,
  ProfileTrend,
  TodayReviewItemView,
  TodaySummaryView,
} from "@/lib/types";

interface GrowthEvidenceProps {
  profile: ProfileSummary | null;
  trend: ProfileTrend | null;
  today: TodaySummaryView;
  traces: CollaborationTraceEvent[];
  reviews: TodayReviewItemView[];
}

export function GrowthEvidence({ profile, trend, today, traces, reviews }: GrowthEvidenceProps) {
  const weakPoints = profile?.weak_points ?? [];
  const concepts = profile?.mistake_stats.top_concepts ?? [];
  const resolved = trend?.resolved_weak_points ?? [];
  const added = trend?.new_weak_points ?? [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <WsCard title="薄弱点变化" eyebrow="Weakness">
        {weakPoints.length === 0 ? (
          <p className="text-sm leading-6 text-slate-600">
            当前没有明确薄弱点。完成一次错题复盘或目标诊断后，这里会显示变化方向。
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {weakPoints.map((point) => (
              <Tag key={point} tone="warning">
                {point}
              </Tag>
            ))}
          </div>
        )}
        <div className="mt-5 space-y-3">
          <EvidenceLine
            icon={AlertTriangle}
            label="高频错因"
            value={concepts.length > 0 ? concepts.join("、") : "暂无集中错因"}
          />
          <EvidenceLine
            icon={CheckCircle2}
            label="已缓解"
            value={resolved.length > 0 ? resolved.join("、") : "暂无历史快照证据"}
          />
          <EvidenceLine
            icon={AlertTriangle}
            label="新增关注"
            value={added.length > 0 ? added.join("、") : "暂无新增薄弱点"}
          />
          <EvidenceLine
            icon={Clock3}
            label="待复习"
            value={reviews.length > 0 ? reviews.map((item) => item.topic).join("、") : "今日没有复习队列"}
          />
        </div>
        {trend && trend.items.length >= 2 ? (
          <div className="mt-6 border-t border-dashed border-[var(--ws-line-strong)] pt-4">
            <p className="ws-eyebrow">Knowledge Ledger</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              首份快照与最新快照之间，每个知识点的掌握度变化。
            </p>
            <div className="mt-4">
              <MasteryLedger trend={trend} />
            </div>
          </div>
        ) : null}
      </WsCard>

      <WsCard title="学习证据" eyebrow="Evidence">
        <div className="ws-scroll max-h-[520px] space-y-4 pr-1">
          <EvidenceLine
            icon={BookOpenText}
            label="当前主任务"
            value={today.mainTask.title}
          />
          <EvidenceLine
            icon={CheckCircle2}
            label="资源使用效果"
            value={studyEffect(profile)}
          />
          <EvidenceLine
            icon={NotebookPen}
            label="错题复盘完成率"
            value={mistakeReviewRate(profile)}
          />
          <EvidenceLine
            icon={GitBranch}
            label="协作轨迹"
            value={traces.length > 0 ? `${traces.length} 条智能体协作记录` : "完成一次 AI 导师对话后生成"}
          />
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          学习证据用于说明系统为什么认为你在进步：它来自路径推进、资源沉淀、
          错题复盘和智能体协作，而不是单纯的访问次数。
        </p>
      </WsCard>
    </div>
  );
}

/* 行为统计：来自资源详情页的学习状态点选（unread/in_progress/done/reviewed） */
function studyEffect(profile: ProfileSummary | null): string {
  const stats = profile?.study_stats;
  if (!stats || stats.in_progress + stats.done + stats.reviewed === 0) {
    return "在资源详情页标记学习状态后，这里会显示使用效果。";
  }
  return `学习中 ${stats.in_progress} · 已完成 ${stats.done} · 已复盘 ${stats.reviewed}`;
}

function mistakeReviewRate(profile: ProfileSummary | null): string {
  const stats = profile?.mistake_stats;
  if (!stats || stats.total === 0) return "暂无错题记录";
  const reviewed = stats.total - stats.open;
  const rate = Math.round((reviewed / stats.total) * 100);
  return `${reviewed}/${stats.total}（${rate}%）已进入复盘`;
}

function EvidenceLine({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof AlertTriangle;
  label: string;
  value: string;
}) {
  return (
    <div className="border-l border-[#898989]/20 pl-3">
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Icon size={14} className="text-slate-400" aria-hidden />
        <span>{label}</span>
      </div>
      <p className="mt-1 text-sm leading-6 text-[var(--ws-ink)]">{value}</p>
    </div>
  );
}
