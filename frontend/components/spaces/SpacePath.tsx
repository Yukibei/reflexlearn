import { Check, CircleDot, MoveRight } from "lucide-react";

import type { SpacePathStep } from "@/lib/types";

function stepState(step: SpacePathStep): "done" | "current" | "next" {
  if (step.mastery_status === "done") return "done";
  if (step.mastery_status === "in_progress") return "current";
  return "next";
}

const STATE_LABEL = {
  done: "已完成",
  current: "当前节点",
  next: "待推进",
} as const;

export function SpacePath({ steps }: { steps: SpacePathStep[] }) {
  if (steps.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="text-xl font-medium text-[var(--ws-ink)]">学习路径</h2>
        <div className="ws-dashboard-card px-5 py-6 text-sm leading-6 text-[#747474]">
          这个目标还没有生成路径。你可以先从一次目标拆解开始，让系统沉淀第一组节点。
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--ws-accent)]">
          Path
        </p>
        <h2 className="mt-2 text-xl font-medium text-[var(--ws-ink)]">按顺序推进的学习路径</h2>
      </div>

      <ol className="space-y-3 pr-1">
        {steps.map((step) => {
          const state = stepState(step);
          const Icon = state === "done" ? Check : state === "current" ? CircleDot : MoveRight;
          return (
            <li key={`${step.sequence}-${step.task_ref}`} className="ws-dashboard-card grid gap-3 rounded-3xl p-4 sm:grid-cols-[42px_1fr]">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#303030] text-white">
                <Icon size={17} aria-hidden />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>{String(step.sequence).padStart(2, "0")}</span>
                  <span>{STATE_LABEL[state]}</span>
                  {step.resource_type ? <span>{step.resource_type}</span> : null}
                </div>
                <h3 className="mt-2 text-base font-medium text-[var(--ws-ink)]">
                  {step.concept || step.task_ref || "学习节点"}
                </h3>
                {step.objective ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">{step.objective}</p>
                ) : null}
                {step.rationale ? (
                  <p className="mt-1 text-xs leading-5 text-slate-500">{step.rationale}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
