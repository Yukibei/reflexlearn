import Link from "next/link";
import {
  BookOpenText,
  ExternalLink,
  FileSearch,
  MessageSquareText,
  PlaySquare,
  Search,
} from "lucide-react";

import { Tag, WsCard } from "@/components/workspace";
import type { LearningResource, ProfileSummary, TodaySummaryView } from "@/lib/types";

interface ResourceDiscoveryProps {
  profile: ProfileSummary | null;
  today: TodaySummaryView;
  resources: LearningResource[];
}

export function ResourceDiscovery({ profile, today, resources }: ResourceDiscoveryProps) {
  const fallbackWeakPoints = today.profileSignals
    .filter((signal) => signal.label.includes("薄弱") || signal.label.includes("卡点"))
    .flatMap((signal) => signal.value.split("、"))
    .filter(Boolean);
  const weakPoints = profile?.weak_points.length
    ? profile.weak_points
    : fallbackWeakPoints.length > 0
      ? fallbackWeakPoints
      : [today.mainTask.pathNode || today.mainTask.title];
  const query = encodeURIComponent(`${today.currentGoal} ${weakPoints.join(" ")}`.trim());
  const hasExternal = resources.some((item) => item.source_policy === "embed_or_redirect_only");

  return (
    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
      <WsCard title="按当前画像推荐" eyebrow="推荐入口">
        <p className="text-sm leading-6 text-slate-600">
          资源推荐会优先看当前目标、薄弱点、错题模式和偏好的学习形式。
          你不需要在资料海里重新筛一遍，先从系统已经判断出的卡点开始。
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Tag tone="accent">{today.currentGoal}</Tag>
          {weakPoints.map((point) => (
            <Tag key={point} tone="warning">
              {point}
            </Tag>
          ))}
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          <SourceLink
            icon={PlaySquare}
            title="B 站"
            description="适合先看直观讲解和课程片段"
            href={`https://search.bilibili.com/all?keyword=${query}`}
          />
          <SourceLink
            icon={BookOpenText}
            title="公开课程"
            description="适合补齐系统课程和章节顺序"
            href={`https://www.coursera.org/search?query=${query}`}
          />
          <SourceLink
            icon={FileSearch}
            title="官方文档"
            description="适合确认概念边界和工具用法"
            href={`https://www.google.com/search?q=${query}%20official%20documentation`}
          />
        </div>
      </WsCard>

      <WsCard title="按学习目标搜索" eyebrow="外部检索">
        <div className="flex items-start gap-3">
          <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center bg-[var(--ws-paper)] text-[var(--ws-ink)]">
            <Search size={17} aria-hidden />
          </span>
          <div>
            <p className="text-sm leading-6 text-slate-600">
              先用外部平台搜索补充候选资源，再让 AI 导师根据你的画像筛选、改写和生成练习。
              当前阶段只保存来源元数据和链接，不下载、不转存外部内容。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/chat"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#ffd85f] px-4 text-sm font-medium text-[#303030] hover:bg-[#ffe38b]"
              >
                <MessageSquareText size={15} aria-hidden />
                让 AI 导师筛选资源
              </Link>
              <Link
                href="/knowledge"
                className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#898989]/20 bg-white/65 px-4 text-sm font-medium text-[#303030] hover:bg-white"
              >
                <BookOpenText size={15} aria-hidden />
                上传课程资料
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-5 border-t border-[var(--ws-line)] pt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ws-accent)]">
            外部来源策略
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            B 站、公开课程、官方文档等外部资源只以来源链接、可选嵌入地址和推荐理由进入资源库。
            {hasExternal ? " 当前资源库已经包含外部来源资源。" : " 当前列表会在接入搜索后逐步补充外部来源。"}
          </p>
        </div>
      </WsCard>
    </section>
  );
}

function SourceLink({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: typeof PlaySquare;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="border-t border-[#898989]/15 py-3 transition-colors hover:text-[#303030] md:border-l md:border-t-0 md:px-3 md:first:border-l-0 md:first:pl-0"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e3e5e6] text-[var(--ws-ink)]">
          <Icon size={16} aria-hidden />
        </span>
        <ExternalLink size={13} className="text-slate-400" aria-hidden />
      </div>
      <h3 className="mt-3 text-sm font-medium text-[var(--ws-ink)]">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
    </a>
  );
}
