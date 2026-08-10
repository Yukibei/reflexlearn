"use client";

import { AlertTriangle, Brain, SlidersHorizontal } from "lucide-react";

import { MasteryMeter, useCountUp } from "@/components/profile/ProfileGauges";
import { Tag, WsCard } from "@/components/workspace";
import type { ProfileSummary } from "@/lib/types";

interface ProfileEvidenceProps {
  profile: ProfileSummary;
}

function preferenceText(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(preferenceText).join("、");
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, item]) => `${key}: ${preferenceText(item)}`)
      .join("；");
  }
  return "未记录";
}

export function ProfileEvidence({ profile }: ProfileEvidenceProps) {
  const knowledge = Object.entries(profile.knowledge_base);
  const preferences = Object.entries(profile.preferences);
  const topConcepts = profile.mistake_stats.top_concepts;

  const mistakeBacked = (point: string) =>
    topConcepts.some(
      (concept) => concept.includes(point) || point.includes(concept),
    );

  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
      <div className="space-y-6">
        <div className="ws-rise" style={{ animationDelay: "320ms" }}>
          <WsCard title="知识基础" eyebrow="Knowledge">
            {knowledge.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">
                还没有足够记录。完成一次目标诊断或上传课程资料后，系统会开始估计各知识点掌握度。
              </p>
            ) : (
              <div className="space-y-5">
                {knowledge.map(([name, score], index) => (
                  <MasteryMeter
                    key={name}
                    name={name}
                    score={score}
                    delayMs={index * 110}
                  />
                ))}
              </div>
            )}
            <p className="mt-5 border-t border-dashed border-[var(--ws-line-strong)] pt-3 text-xs leading-5 text-slate-500">
              掌握度由对话诊断、练习正误与资源完成情况持续修正，刻度每格 10%。
            </p>
          </WsCard>
        </div>

        <div className="ws-rise" style={{ animationDelay: "440ms" }}>
          <WsCard title="学习偏好" eyebrow="Preferences">
            <div className="grid gap-3 md:grid-cols-2">
              <PreferenceLine icon="brain" label="认知风格" value={profile.cognitive_style} />
              {preferences.length === 0 ? (
                <PreferenceLine icon="sliders" label="资源偏好" value="未记录" />
              ) : (
                preferences.map(([key, value]) => (
                  <PreferenceLine
                    key={key}
                    icon="sliders"
                    label={key}
                    value={preferenceText(value)}
                  />
                ))
              )}
            </div>
          </WsCard>
        </div>
      </div>

      <div className="space-y-6">
        <div className="ws-rise" style={{ animationDelay: "380ms" }}>
          <WsCard title="薄弱点" eyebrow="Weak Points">
            {profile.weak_points.length === 0 ? (
              <p className="text-sm leading-6 text-slate-600">
                当前没有明确薄弱点。系统会从对话、错题、资源完成情况中持续更新。
              </p>
            ) : (
              <ol className="space-y-3">
                {profile.weak_points.map((point, index) => (
                  <li
                    key={point}
                    className="flex items-baseline gap-3 border-b border-dashed border-[var(--ws-line)] pb-3 last:border-0 last:pb-0"
                  >
                    <span className="ws-serif shrink-0 text-xl leading-none text-[rgb(5_26_36/0.28)]">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 text-sm font-medium text-[var(--ws-ink)]">
                      {point}
                    </span>
                    <span className="ml-auto flex shrink-0 gap-1.5">
                      {index === 0 ? <Tag tone="accent">最优先</Tag> : null}
                      {mistakeBacked(point) ? <Tag tone="warning">错题印证</Tag> : null}
                    </span>
                  </li>
                ))}
              </ol>
            )}
            <p className="mt-4 text-xs leading-5 text-slate-500">
              排序代表补救优先级；标注「错题印证」的薄弱点同时出现在你的错题高频概念里。
            </p>
          </WsCard>
        </div>

        <div className="ws-rise" style={{ animationDelay: "500ms" }}>
          <WsCard title="错题模式" eyebrow="Mistake Pattern">
            <div className="grid grid-cols-2 gap-4">
              <MistakeFigure label="错题总数" value={profile.mistake_stats.total} />
              <MistakeFigure label="待复盘" value={profile.mistake_stats.open} warn />
            </div>
            <div className="mt-5 border-t border-dashed border-[var(--ws-line-strong)] pt-4">
              <p className="text-xs tracking-wide text-slate-500">高频概念</p>
              {topConcepts.length === 0 ? (
                <p className="mt-2 text-sm leading-6 text-slate-600">暂无集中模式。</p>
              ) : (
                <ol className="mt-2 space-y-2">
                  {topConcepts.map((concept, index) => (
                    <li key={concept} className="flex items-baseline gap-3">
                      <span className="ws-serif text-2xl leading-none text-[rgb(5_26_36/0.22)]">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="text-sm font-medium text-[var(--ws-ink)]">
                        {concept}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <p className="mt-4 text-xs leading-5 text-slate-500">
              错题模式决定补救顺序：先处理重复出现的概念，再补齐相关先修知识。
            </p>
          </WsCard>
        </div>
      </div>
    </div>
  );
}

function MistakeFigure({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  const counted = useCountUp(value);
  return (
    <div>
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <AlertTriangle
          size={13}
          className={warn && value > 0 ? "text-amber-500" : "text-slate-400"}
          aria-hidden
        />
        {label}
      </p>
      <p className="ws-serif mt-1.5 text-4xl leading-none text-[var(--ws-ink)]">
        {counted}
        <span className="ml-1 text-base text-slate-500">道</span>
      </p>
    </div>
  );
}

function PreferenceLine({
  icon,
  label,
  value,
}: {
  icon: "brain" | "sliders";
  label: string;
  value: string;
}) {
  const Icon = icon === "brain" ? Brain : SlidersHorizontal;
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
