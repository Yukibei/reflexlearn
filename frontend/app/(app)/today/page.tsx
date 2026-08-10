"use client";

import { useEffect, useState } from "react";

import { useAuthSession } from "@/lib/authContext";
import { fallbackToday } from "@/lib/todayFallback";
import { getTodaySummary } from "@/lib/todayApi";
import type { TodaySummaryView } from "@/lib/types";
import { TodayHero } from "@/components/today/TodayHero";
import { TodayMainTask } from "@/components/today/TodayMainTask";
import { LearningPathPreview } from "@/components/today/LearningPathPreview";
import { RecommendedResources } from "@/components/today/RecommendedResources";
import { TutorPrompt } from "@/components/today/TutorPrompt";
import { QuickActions } from "@/components/today/QuickActions";
import { ProfileSignals, ReviewQueue } from "@/components/today/LearningSignals";

// 时段问候依赖客户端本地时区，须在 mounted 后计算——否则 SSR(服务端时区) 与
// 浏览器时区的小时数不一致会触发 hydration mismatch。SSR 渲染稳定的「你好」。
function greetingPrefix(hour: number | null): string {
  if (hour === null) return "你好";
  if (hour < 6) return "夜深了";
  if (hour < 12) return "早上好";
  if (hour < 18) return "下午好";
  return "晚上好";
}

export default function TodayPage() {
  const { auth } = useAuthSession();
  const [remoteToday, setRemoteToday] = useState<TodaySummaryView | null>(null);
  const [loadError, setLoadError] = useState("");
  const today = remoteToday ?? fallbackToday;
  const primaryHref = today.mainTask.spaceId ? `/spaces/${today.mainTask.spaceId}` : "/spaces";
  const [hour, setHour] = useState<number | null>(null);
  const totalMinutes = today.resources.reduce(
    (sum, resource) => sum + resource.estimatedMinutes,
    today.mainTask.estimatedMinutes,
  );
  const explanationTopic = today.mainTask.pathNode || today.mainTask.title;
  const taskSecondaryActions = [
    {
      label: "让 AI 导师解释",
      href: `/chat?action=explain&topic=${encodeURIComponent(explanationTopic)}`,
      icon: "explain",
    },
    { label: "调整学习顺序", href: "/plan", icon: "adjust" },
  ] as const;

  useEffect(() => {
    setHour(new Date().getHours());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoadError("");
    getTodaySummary(auth.access_token)
      .then((data) => {
        if (!cancelled) setRemoteToday(data);
      })
      .catch(() => {
        if (!cancelled) {
          setRemoteToday(null);
          setLoadError("当前显示离线学习建议，稍后会自动恢复同步。");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [auth.access_token]);

  return (
    <section className="ws-page gap-4">
      <TodayHero
        greeting={`${greetingPrefix(hour)}，${today.greeting}`}
        learner={auth.user.user_id}
        goal={today.currentGoal}
        summary={`当前主线：${today.mainTask.pathNode || today.mainTask.title}`}
        progress={today.progress}
        pathCount={today.pathNodes.length}
        resourceCount={today.resources.length}
        reviewCount={today.reviewQueue.length}
        totalMinutes={totalMinutes}
      />

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 lg:grid-rows-[350px_320px]">
        <div className="min-h-0 md:col-start-1 md:row-start-1 lg:col-start-1 lg:row-start-1">
          <TodayMainTask
            task={today.mainTask}
            primaryHref={primaryHref}
            secondaryActions={taskSecondaryActions}
          />
        </div>
        <div className="min-h-0 md:col-start-2 md:row-start-1 lg:col-start-2 lg:row-start-1">
          <LearningPathPreview
            phase={today.mainTask.spaceName || "学习主线"}
            progress={Math.round(today.progress * 100)}
            nodes={today.pathNodes}
            recommendation={today.pathRecommendation}
          />
        </div>
        <div className="min-h-0 md:col-start-1 md:row-start-2 lg:col-start-3 lg:row-start-1">
          <QuickActions actions={today.quickActions} />
        </div>

        <aside className="flex min-h-0 flex-col gap-3 md:col-span-2 md:row-start-3 md:grid md:grid-cols-2 lg:col-span-1 lg:col-start-4 lg:row-span-2 lg:row-start-1 lg:flex">
          <TutorPrompt
            prompt={{
              message: today.tutorPrompt,
              actionLabel: "和 AI 导师聊聊",
              href: "/chat",
            }}
          />
          <ReviewQueue items={today.reviewQueue} />
        </aside>

        <div className="min-h-0 md:col-start-2 md:row-start-2 lg:col-start-1 lg:row-start-2">
          <ProfileSignals signals={today.profileSignals} />
        </div>
        <div className="min-h-0 md:col-span-2 md:row-start-4 lg:col-start-2 lg:col-end-4 lg:row-start-2">
          <RecommendedResources resources={today.resources} />
        </div>
      </div>

      {loadError ? (
        <p className="ws-dashboard-card px-4 py-3 text-xs leading-5 text-[#747474]" role="status">
          {loadError}
        </p>
      ) : null}
    </section>
  );
}
