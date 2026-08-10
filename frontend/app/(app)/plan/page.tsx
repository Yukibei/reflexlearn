"use client";

import { useCallback, useEffect, useState } from "react";

import { PlanActionPanel } from "@/components/plan/PlanActionPanel";
import { PlanTimeline } from "@/components/plan/PlanTimeline";
import { ProgressRing } from "@/components/profile/ProfileGauges";
import { PageHeader, Tag } from "@/components/workspace";
import { useAuthSession } from "@/lib/authContext";
import { fallbackToday } from "@/lib/todayFallback";
import { getTodaySummary } from "@/lib/todayApi";
import type { TodaySummaryView } from "@/lib/types";

export default function PlanPage() {
  const { auth } = useAuthSession();
  const [remoteToday, setRemoteToday] = useState<TodaySummaryView | null>(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const today = remoteToday ?? fallbackToday;

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true);
      setLoadError("");
      return getTodaySummary(auth.access_token)
        .then((data) => setRemoteToday(data))
        .catch(() => {
          setRemoteToday(null);
          setLoadError("当前显示离线学习路径，稍后会自动恢复同步。");
        })
        .finally(() => setLoading(false));
    },
    [auth.access_token],
  );

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="ws-page">
      <PageHeader
        eyebrow="Learning Path"
        title="学习路径"
        description="把目标拆成可推进的节点：先看当前学习路径，再根据错题、画像和资源完成情况调整顺序。"
      />

      <section className="ws-card ws-rise p-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <span
            className={`ws-stamp ${
              today.degraded.length > 0 || loadError ? "text-amber-600" : "text-[var(--ws-accent)]"
            }`}
          >
            {today.degraded.length > 0 || loadError ? "部分同步" : "实时同步"}
          </span>
          <div className="text-right">
            <p className="ws-eyebrow">Itinerary Nº</p>
            <p className="ws-serif mt-0.5 text-lg tracking-[0.18em] text-[var(--ws-ink)]">
              {(today.mainTask.spaceName || "MAINLINE").slice(0, 8).toUpperCase()}
            </p>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Tag tone="accent">{today.mainTask.spaceName || "学习主线"}</Tag>
        </div>

        <div className="mt-4 grid items-end gap-6 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="ws-serif text-3xl leading-tight text-[var(--ws-ink)]">
              {today.currentGoal}
            </p>
            <p className="mt-4 max-w-xl border-t border-dashed border-[var(--ws-line-strong)] pt-4 text-sm leading-6 text-slate-600">
              当前路径不只是章节清单，它会根据画像、错题和资源使用情况持续调整。
              推荐理由会明确说明为什么先学这一段、哪些资源应当跟着使用。
            </p>
          </div>
          <ProgressRing percent={Math.round(today.progress * 100)} label="目标进度" />
        </div>
      </section>

      {loading ? (
        <PlanSkeleton />
      ) : (
        <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1.36fr)_minmax(320px,0.74fr)]">
          <PlanTimeline
            nodes={today.pathNodes}
            progress={today.progress}
            recommendation={today.pathRecommendation}
            token={auth.access_token}
            onChanged={() => void load(true)}
          />
          <PlanActionPanel
            task={today.mainTask}
            resources={today.resources}
            reviews={today.reviewQueue}
          />
        </div>
      )}

      {loadError ? (
        <p className="text-xs leading-5 text-slate-500" role="status">
          {loadError}
        </p>
      ) : null}
    </section>
  );
}

function PlanSkeleton() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.36fr)_minmax(320px,0.74fr)]">
      <div className="ws-skeleton h-[520px]" />
      <div className="space-y-5">
        <div className="ws-skeleton h-64" />
        <div className="ws-skeleton h-72" />
      </div>
    </div>
  );
}
