"use client";

import Link from "next/link";
import {
  ArrowUpRight,
  BrainCircuit,
  Library,
  MessageCircle,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import { CompanionAvatar } from "@/components/companion";
import type { PetMood } from "@/components/companion/sprites";
import type { ProfileSummary, TodaySummaryView } from "@/lib/types";
import type { TutorRuntimeStatus, WorkspaceRuntimeState } from "./tutorRuntime";

const STATUS_META: Record<
  TutorRuntimeStatus,
  { label: string; detail: string; mood: PetMood }
> = {
  idle: { label: "等待你的目标", detail: "把当前问题交给我", mood: "study" },
  thinking: { label: "正在理解问题", detail: "先读取学习上下文", mood: "think" },
  running: { label: "智能体协作中", detail: "正在组织路径与资源", mood: "work" },
  success: { label: "本轮建议已生成", detail: "可以继续追问或保存产物", mood: "celebrate" },
  failed: { label: "本轮生成遇到问题", detail: "可以调整问题后重试", mood: "stumble" },
};

interface TutorMentorPanelProps {
  today: TodaySummaryView;
  profile: ProfileSummary | null;
  runtime: WorkspaceRuntimeState;
}

export function TutorMentorPanel({ today, profile, runtime }: TutorMentorPanelProps) {
  const status = STATUS_META[runtime.status];
  const currentNode =
    today.pathNodes.find((node) => node.status === "current")?.title ||
    today.mainTask.pathNode ||
    "等待生成学习路径";
  const weakPoints = profile?.weak_points.length
    ? profile.weak_points.slice(0, 3)
    : today.profileSignals
        .filter((signal) => signal.label.includes("薄弱") || signal.label.includes("卡点"))
        .flatMap((signal) => signal.value.split("、"))
        .filter(Boolean)
        .slice(0, 3);
  const progress = Math.round((profile?.progress ?? today.progress) * 100);

  return (
    <aside className="flex min-h-[520px] flex-col overflow-hidden rounded-3xl bg-[#303030] text-white shadow-[0_16px_44px_rgb(48_48_48/0.16)] xl:h-[calc(100dvh-176px)] xl:max-h-[680px] xl:min-h-[520px]">
      <div className="border-b border-white/10 px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#ffd85f]">
            <Sparkles size={16} aria-hidden />
            <span className="text-xs font-medium tracking-[0.16em]">NIUNIU TUTOR</span>
          </div>
          <span className="inline-flex items-center gap-2 text-[11px] text-white/48">
            <span
              className={`h-2 w-2 rounded-full bg-[#ffd85f] ${runtime.streaming ? "animate-pulse" : ""}`}
            />
            在线
          </span>
        </div>

        <div className="relative mt-1 flex min-h-32 items-center justify-center">
          <span className="absolute bottom-3 h-2.5 w-20 rounded-full bg-black/[0.38] blur-md" aria-hidden />
          <CompanionAvatar mood={status.mood} size={112} />
        </div>

        <div className="text-center">
          <h2 className="text-lg font-medium">{status.label}</h2>
          <p className="mt-1 text-xs text-white/45">{status.detail}</p>
        </div>
      </div>

      <div className="ws-scroll min-h-0 flex-1">
        <section className="border-b border-white/10 px-5 py-4">
          <p className="text-[11px] text-white/42">当前学习上下文</p>
          <h3 className="mt-2 line-clamp-2 text-base font-medium leading-6">{today.currentGoal}</h3>
          <div className="mt-3 flex items-center justify-between text-xs text-white/48">
            <span>当前节点</span>
            <span className="max-w-[65%] truncate text-right text-white/78" title={currentNode}>
              {currentNode}
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-[#ffd85f]" style={{ width: `${progress}%` }} />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-white/38">
            <span>主线进度</span>
            <span>{progress}%</span>
          </div>
        </section>

        <section className="border-b border-white/10 px-5 py-4">
          <div className="flex items-center gap-2 text-white/70">
            <BrainCircuit size={15} aria-hidden />
            <h3 className="text-sm font-medium">导师正在关注</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(weakPoints.length ? weakPoints : ["等待本轮诊断"]).map((point) => (
              <span key={point} className="max-w-full truncate rounded-full border border-white/12 px-2.5 py-1 text-xs text-white/58" title={point}>
                {point}
              </span>
            ))}
          </div>
        </section>

        <section className="px-5 py-4">
          <p className="text-[11px] text-white/42">本轮产物</p>
          <div className="mt-3 divide-y divide-white/10 border-y border-white/10">
            <OutputLink href="/plan" icon={Route} label="学习路径" value={runtime.pathCount} />
            <OutputLink href="/resources" icon={Library} label="学习资源" value={runtime.resourceCount} />
            <OutputLink
              href="#tutor-conversation"
              icon={MessageCircle}
              label="对话轮次"
              value={runtime.turnCount}
            />
          </div>
        </section>
      </div>

      <div className="grid grid-cols-2 border-t border-white/10">
        <FooterLink href="/profile" label="学习画像" />
        <FooterLink href="/today" label="今日任务" />
      </div>
    </aside>
  );
}

function OutputLink({
  href,
  icon: Icon,
  label,
  value,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 py-3 text-sm transition-colors hover:text-[#ffd85f]">
      <Icon size={15} className="text-white/45 group-hover:text-[#ffd85f]" aria-hidden />
      <span className="flex-1">{label}</span>
      <span className="tabular-nums text-white/42">{value}</span>
      <ArrowUpRight size={14} className="text-white/35" aria-hidden />
    </Link>
  );
}

function FooterLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-center gap-1.5 border-r border-white/10 px-3 py-3.5 text-xs text-white/58 transition-colors last:border-r-0 hover:bg-white/5 hover:text-white">
      {label}
      <ArrowUpRight size={13} aria-hidden />
    </Link>
  );
}
