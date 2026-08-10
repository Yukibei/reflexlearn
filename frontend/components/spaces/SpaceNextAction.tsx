import Link from "next/link";
import { ArrowRight, BookOpenCheck, FileQuestion, MessageSquareText } from "lucide-react";

import type { SpaceDetail, SpacePathStep } from "@/lib/types";

import { nextStep } from "./spaceView";

export function SpaceNextAction({ detail }: { detail: SpaceDetail }) {
  const step = nextStep(detail.steps);

  return (
    <aside className="space-y-5">
      <section className="ws-dashboard-card rounded-3xl p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ws-accent)]">
          Next
        </p>
        <h2 className="mt-3 text-xl font-medium leading-snug text-[var(--ws-ink)]">
          {step ? `下一步：${step.concept || step.objective || "继续当前节点"}` : "先建立第一条路径"}
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {nextCopy(step)}
        </p>
        <Link
          href="/today"
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-full bg-[#ffd85f] px-4 text-sm font-medium text-[#303030] transition hover:bg-[#ffe38b]"
        >
          回到今日学习
          <ArrowRight size={15} aria-hidden />
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-medium text-[var(--ws-ink)]">快速动作</h2>
        <QuickLink href="/chat" icon={MessageSquareText} label="向 AI 导师提问" />
        <QuickLink href="/mistakes" icon={FileQuestion} label="复盘一道相关错题" />
        <QuickLink href="/resources" icon={BookOpenCheck} label="查看学习资源库" />
      </section>

      {detail.degraded.length > 0 ? (
        <p className="rounded-2xl border border-[#ffd85f]/70 bg-[#fff4c8]/70 px-4 py-3 text-xs leading-5 text-[#746016]">
          部分学习记录暂时无法同步，当前页面已保留可用内容。
        </p>
      ) : null}
    </aside>
  );
}

function nextCopy(step: SpacePathStep | null): string {
  if (!step) return "先和 AI 导师描述你的目标，系统会把路径和资源沉淀到这里。";
  if (step.objective) return step.objective;
  if (step.rationale) return step.rationale;
  return "先完成这个节点，再进入后续练习和资源复盘。";
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof MessageSquareText;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl bg-white/55 px-4 py-3 text-sm font-medium text-[#747474] transition hover:bg-white/85 hover:text-[#303030]"
    >
      <Icon size={16} className="text-[var(--ws-accent)]" aria-hidden />
      {label}
    </Link>
  );
}
