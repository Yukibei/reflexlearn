"use client";

import { Tag } from "@/components/workspace";
import { DossierStat, MasteryMeter } from "@/components/profile/ProfileGauges";
import { TrendPlaceholder, TrendSparkline } from "@/components/growth/GrowthTrendChart";
import type { ProfileSummary, ProfileTrend, TodaySummaryView } from "@/lib/types";

interface GrowthSummaryProps {
  profile: ProfileSummary | null;
  trend: ProfileTrend | null;
  today: TodaySummaryView;
  traceCount: number;
}

/* 数据来源印章：与 /profile 档案语言一致（盖章 = 这份记录的出处） */
const SOURCE_META: Record<string, { label: string; className: string }> = {
  redis: { label: "实时记忆", className: "text-[var(--ws-accent)]" },
  pg: { label: "历史画像", className: "text-slate-500" },
  empty: { label: "待完善", className: "text-amber-600" },
};

export function GrowthSummary({ profile, trend, today, traceCount }: GrowthSummaryProps) {
  const trendPoints = trend?.items.length ?? 0;
  const hasTrend = trendPoints >= 2;
  const progressDelta = Math.round((trend?.progress_delta ?? 0) * 100);
  const profileProgress = profile?.progress ?? trend?.latest_progress ?? today.progress;
  const stamp = SOURCE_META[profile?.source ?? "empty"] ?? SOURCE_META.empty;
  const ledgerNo = (profile?.user_id || "guest").slice(0, 8).toUpperCase();

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <section className="ws-dashboard-card ws-rise p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <span className={`ws-stamp ${stamp.className}`}>{stamp.label}</span>
          <div className="text-right">
            <p className="ws-eyebrow">Ledger Nº</p>
            <p className="ws-serif mt-0.5 text-lg tracking-[0.18em] text-[var(--ws-ink)]">
              {ledgerNo}
            </p>
          </div>
        </header>

        {today.degraded.length > 0 || profile?.degraded.length ? (
          <div className="mt-4">
            <Tag tone="warning">部分记录同步中</Tag>
          </div>
        ) : null}

        <p className="ws-serif mt-6 text-3xl leading-tight text-[var(--ws-ink)]">
          {today.currentGoal}
        </p>

        <div className="mt-6 border-t border-dashed border-[var(--ws-line-strong)] pt-5">
          {hasTrend && trend ? (
            <>
              <div className="flex items-baseline justify-between">
            <p className="ws-eyebrow">成长趋势</p>
                <p className="text-xs text-slate-500">
                  能力变化：跨 {trendPoints} 份快照推进
                  <span
                    className={`ws-serif ml-1.5 text-base ${
                      progressDelta > 0 ? "text-[var(--ws-accent)]" : "text-[var(--ws-ink)]"
                    }`}
                  >
                    {progressDelta >= 0 ? "+" : ""}
                    {progressDelta}%
                  </span>
                </p>
              </div>
              <div className="mt-3">
                <TrendSparkline trend={trend} />
              </div>
            </>
          ) : (
            <>
              <p className="ws-eyebrow">成长趋势</p>
              <div className="mt-3">
                <TrendPlaceholder count={trendPoints} />
              </div>
            </>
          )}
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <MasteryMeter name="画像进度" score={profileProgress} />
          <MasteryMeter name="今日路径" score={today.progress} delayMs={140} />
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
        <div className="ws-rise" style={{ animationDelay: "90ms" }}>
          <DossierStat
            label="档案快照"
            value={trendPoints}
            hint="画像每次实质变化自动留档"
          />
        </div>
        <div className="ws-rise" style={{ animationDelay: "170ms" }}>
          <DossierStat
            label="学习资源"
            value={profile?.resources_count ?? today.resources.length}
            hint="已沉淀或正在推荐的资源"
          />
        </div>
        <div className="ws-rise" style={{ animationDelay: "250ms" }}>
          <DossierStat
            label={traceCount > 0 ? "协作记录" : "待处理薄弱点"}
            value={traceCount > 0 ? traceCount : profile?.weak_points.length ?? 0}
            hint={traceCount > 0 ? "智能体协作与产出证据" : "影响路径顺序和复习安排"}
          />
        </div>
      </div>
    </div>
  );
}
