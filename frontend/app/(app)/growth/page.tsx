"use client";

import { useEffect, useState } from "react";
import { Download, FileDown, Filter, ShieldCheck, Sparkles, Sprout } from "lucide-react";

import { GrowthEvidence } from "@/components/growth/GrowthEvidence";
import { GrowthSummary } from "@/components/growth/GrowthSummary";
import {
  EmptyState,
  PageHeader,
  StatCard,
  Tag,
  WsButton,
  WsCard,
} from "@/components/workspace";
import { apiJson, getErrorMessage } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import { getProfileHistory, getProfileSummary } from "@/lib/profileApi";
import { fallbackToday } from "@/lib/todayFallback";
import { getTodaySummary } from "@/lib/todayApi";
import type {
  CollaborationTraceEvent,
  LoraExportRecord,
  LoraExportResult,
  ProfileSummary,
  ProfileTrend,
  TodaySummaryView,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function GrowthPage() {
  const { auth } = useAuthSession();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [trend, setTrend] = useState<ProfileTrend | null>(null);
  const [today, setToday] = useState<TodaySummaryView>(fallbackToday);
  const [items, setItems] = useState<CollaborationTraceEvent[]>([]);
  const [exports, setExports] = useState<LoraExportRecord[]>([]);
  const [latest, setLatest] = useState<LoraExportResult | null>(null);
  const [exporting, setExporting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.allSettled([
      getProfileSummary(auth.access_token),
      getProfileHistory(auth.access_token),
      getTodaySummary(auth.access_token),
      apiJson<{ items: CollaborationTraceEvent[] }>(
        `${API_BASE}/collaboration/traces`,
        auth.access_token,
      ),
      apiJson<{ items: LoraExportRecord[] }>(
        `${API_BASE}/growth/lora-samples`,
        auth.access_token,
      ),
    ])
      .then(([profileResult, trendResult, todayResult, traceResult, exportResult]) => {
        if (cancelled) return;
        if (profileResult.status === "fulfilled") setProfile(profileResult.value);
        if (trendResult.status === "fulfilled") setTrend(trendResult.value);
        if (todayResult.status === "fulfilled") setToday(todayResult.value);
        if (traceResult.status === "fulfilled") setItems(traceResult.value.items);
        if (exportResult.status === "fulfilled") setExports(exportResult.value.items);
        const failures = [profileResult, trendResult, todayResult, traceResult, exportResult].filter(
          (result) => result.status === "rejected",
        );
        if (failures.length > 0) setError("部分成长记录暂时无法同步，当前页面已保留可用内容。");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.access_token]);

  const exportSamples = async () => {
    setExporting(true);
    setError("");
    try {
      const result = await apiJson<LoraExportResult>(
        `${API_BASE}/growth/lora-samples/export`,
        auth.access_token,
        { method: "POST", body: "{}" },
      );
      setLatest(result);
      setExports((prev) => [
        {
          file_path: result.file_path,
          sample_count: result.sample_count,
          created_at: Date.now() / 1000,
          sanitized: result.sanitized,
        },
        ...prev.filter((item) => item.file_path !== result.file_path),
      ]);
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const sanitized = latest?.sanitized ?? exports[0]?.sanitized;
  const latestPath = latest?.file_path ?? exports[0]?.file_path;

  return (
    <section className="ws-page">
      <PageHeader
        eyebrow="Growth"
        title="成长档案"
        description="把路径推进、薄弱点变化、复习状态和学习证据放在同一页，帮助你判断下一段学习是否真的变稳。"
        actions={
          <WsButton variant="primary" onClick={exportSamples} disabled={exporting}>
            <Download size={15} aria-hidden />
            {exporting ? "导出中…" : "导出训练样本"}
          </WsButton>
        }
      />

      {error ? (
        <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <GrowthSkeleton />
      ) : (
        <>
          <GrowthSummary profile={profile} trend={trend} today={today} traceCount={items.length} />
          <GrowthEvidence
            profile={profile}
            trend={trend}
            today={today}
            traces={items}
            reviews={today.reviewQueue}
          />
          <TechnicalEvidence
            items={items}
            latest={latest}
            exports={exports}
            sanitized={sanitized}
            latestPath={latestPath}
          />
        </>
      )}
    </section>
  );
}

function GrowthSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="ws-skeleton h-72" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ws-skeleton h-28" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="ws-skeleton h-56" />
        <div className="ws-skeleton h-56" />
      </div>
    </div>
  );
}

function TechnicalEvidence({
  items,
  latest,
  exports,
  sanitized,
  latestPath,
}: {
  items: CollaborationTraceEvent[];
  latest: LoraExportResult | null;
  exports: LoraExportRecord[];
  sanitized?: boolean;
  latestPath?: string;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.74fr)_minmax(0,1.26fr)]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <StatCard
            label="最近样本数"
            icon={Sparkles}
            value={latest?.sample_count ?? exports[0]?.sample_count ?? 0}
          />
          <StatCard label="过滤轨迹" icon={Filter} value={latest?.filtered_count ?? 0} />
          <StatCard
            label="脱敏状态"
            icon={ShieldCheck}
            value={
              sanitized ? (
                <Tag tone="success" className="text-sm">已脱敏</Tag>
              ) : (
                <Tag tone="neutral" className="text-sm">暂无导出</Tag>
              )
            }
            hint={latestPath ? undefined : "导出后会生成可审计的 JSONL 文件"}
          />
        </div>
        {latestPath ? (
          <p className="flex items-start gap-2 break-all text-xs text-slate-500">
            <FileDown size={14} className="mt-0.5 shrink-0" aria-hidden />
            {latestPath}
          </p>
        ) : null}
      </div>

      <WsCard title="协作轨迹" eyebrow="Technical Evidence">
        {items.length === 0 ? (
          <EmptyState
            icon={Sprout}
            title="暂无协作轨迹"
            description="完成一次 AI 导师对话后，画像、规划、生成、批判等节点会形成可追溯记录。"
            framed={false}
          />
        ) : (
          <ol className="ml-2 border-l border-[var(--ws-line-strong)]">
            {items.slice(0, 8).map((item) => (
              <li key={item.trace_id} className="relative pb-6 pl-6 last:pb-1">
                <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--ws-navy)]" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-[var(--ws-ink)]">{item.node}</span>
                  <span className="text-xs text-slate-500">
                    <ClientTime ts={item.created_at} />
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-slate-500">{item.event_type}</p>
              </li>
            ))}
          </ol>
        )}
      </WsCard>
    </div>
  );
}

/* 本地时间格式化依赖浏览器时区，须 mounted 后渲染：避免 SSR(服务端时区) 与
   客户端 toLocaleString 不一致触发 hydration mismatch。SSR 渲染空占位。 */
function ClientTime({ ts }: { ts: number }) {
  const [text, setText] = useState("");
  useEffect(() => {
    setText(new Date(ts * 1000).toLocaleString());
  }, [ts]);
  return <span suppressHydrationWarning>{text}</span>;
}
