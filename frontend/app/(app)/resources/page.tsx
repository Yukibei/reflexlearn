"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Library, MessageSquareText } from "lucide-react";

import { ResourceCandidates } from "@/components/resource/ResourceCandidates";
import { ResourceDiscovery } from "@/components/resource/ResourceDiscovery";
import { ResourceList } from "@/components/resource/ResourceList";
import { viewForResource } from "@/components/resource/resourceView";
import { EmptyState, PageHeader } from "@/components/workspace";
import { apiJson, getErrorMessage } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import { getProfileSummary } from "@/lib/profileApi";
import { discoverResources, type ResourceCandidate } from "@/lib/resourceDiscoveryApi";
import { fallbackToday } from "@/lib/todayFallback";
import { getTodaySummary } from "@/lib/todayApi";
import type { LearningResource, ProfileSummary, TodaySummaryView } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function ResourcesPage() {
  const { auth } = useAuthSession();
  const [items, setItems] = useState<LearningResource[]>([]);
  const [candidates, setCandidates] = useState<ResourceCandidate[]>([]);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [today, setToday] = useState<TodaySummaryView>(fallbackToday);
  const [filter, setFilter] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.allSettled([
      apiJson<{ items: LearningResource[] }>(`${API_BASE}/resources`, auth.access_token),
      getProfileSummary(auth.access_token),
      getTodaySummary(auth.access_token),
    ])
      .then(([resourceResult, profileResult, todayResult]) => {
        if (cancelled) return;
        if (resourceResult.status === "fulfilled") setItems(resourceResult.value.items);
        if (profileResult.status === "fulfilled") setProfile(profileResult.value);
        if (todayResult.status === "fulfilled") {
          setToday(todayResult.value);
          void loadCandidates(todayResult.value, profileResult.status === "fulfilled" ? profileResult.value : null);
        }
        if (resourceResult.status === "rejected") {
          setError(getErrorMessage(resourceResult.reason));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.access_token]);

  const loadCandidates = async (summary: TodaySummaryView, profileSummary: ProfileSummary | null) => {
    const weakPoints = profileSummary?.weak_points.length
      ? profileSummary.weak_points
      : summary.profileSignals
          .filter((signal) => signal.label.includes("薄弱") || signal.label.includes("卡点"))
          .flatMap((signal) => signal.value.split("、"))
          .filter(Boolean);
    try {
      const result = await discoverResources(auth.access_token, {
        goal: summary.currentGoal,
        weak_points: weakPoints,
        providers: ["bilibili", "official_doc", "oer"],
        limit: 6,
      });
      setCandidates(result.items);
    } catch {
      setCandidates([]);
    }
  };

  const refreshResources = async () => {
    try {
      const result = await apiJson<{ items: LearningResource[] }>(
        `${API_BASE}/resources`,
        auth.access_token,
      );
      setItems(result.items);
    } catch {
      /* 保存成功但列表刷新失败：保留现有列表，下次进入页面会重新拉取 */
    }
  };

  const types = useMemo(() => [...new Set(items.map((item) => item.type))], [items]);
  const visible = useMemo(
    () => (filter ? items.filter((item) => item.type === filter) : items),
    [filter, items],
  );

  return (
    <section className="ws-page">
      <PageHeader
        eyebrow="Resources"
        title="学习资源库"
        description="按当前画像推荐资源，再按学习目标搜索外部视频、公开课程、官方文档和 AI 生成材料。"
      />

      <ResourceDiscovery profile={profile} today={today} resources={items} />

      {error ? <p className="ws-card rounded-2xl border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      {types.length > 0 ? (
        <div className="ws-scroll flex gap-2 pb-1">
          <FilterButton
            active={filter === null}
            label={`全部 ${items.length}`}
            onClick={() => setFilter(null)}
          />
          {types.map((type) => {
            const count = items.filter((item) => item.type === type).length;
            return (
              <FilterButton
                key={type}
                active={filter === type}
                label={`${viewForResource(type).label} ${count}`}
                onClick={() => setFilter(filter === type ? null : type)}
              />
            );
          })}
        </div>
      ) : null}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="ws-skeleton h-40" />
          ))}
        </div>
      ) : visible.length === 0 && candidates.length === 0 ? (
        <EmptyState
          icon={Library}
          title="资源库还是空的"
          description="完成一次资料整理、练习生成或目标拆解后，相关资源会在这里形成可回看的列表。"
          action={
            <Link
              href="/today"
              className="inline-flex items-center gap-2 bg-[var(--ws-navy)] px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <MessageSquareText size={15} aria-hidden />
              回到今日学习
            </Link>
          }
        />
      ) : (
        <>
          <ResourceCandidates
            candidates={candidates}
            token={auth.access_token}
            onSaved={refreshResources}
          />
          {visible.length > 0 ? <ResourceList resources={visible} /> : null}
        </>
      )}
    </section>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
        active
          ? "bg-[#303030] text-white"
          : "border border-[#898989]/20 bg-white/60 text-[#747474] hover:bg-white"
      }`}
    >
      {label}
    </button>
  );
}
