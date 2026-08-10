import { Check, Library, Route, Sparkles } from "lucide-react";

import { Tag, WsButton, resourceMeta } from "@/components/workspace";
import type {
  MistakeItem,
  MistakePlan,
  MistakeReflection,
  MistakeResource,
} from "@/lib/types";

export type MistakeAction = "reflect" | "plan" | "resources" | "review";
export type InsertState = "idle" | "saving" | "saved" | null;

interface MistakeDetailProps {
  item: MistakeItem;
  reflection: MistakeReflection | null;
  plan: MistakePlan | null;
  resources: MistakeResource[];
  busy: MistakeAction | null;
  insertState?: InsertState;
  onInsertToPath?: () => void;
  onReflect: () => void;
  onPlan: () => void;
  onResources: () => void;
  onMarkReviewed: () => void;
}

const ACTIONS: Array<{
  key: MistakeAction;
  label: string;
  busyLabel: string;
  icon: typeof Sparkles;
}> = [
  { key: "reflect", label: "归因", busyLabel: "归因中…", icon: Sparkles },
  { key: "plan", label: "补救计划", busyLabel: "规划中…", icon: Route },
  { key: "resources", label: "针对性资源", busyLabel: "生成中…", icon: Library },
  { key: "review", label: "标记已复习", busyLabel: "标记中…", icon: Check },
];

export function MistakeDetail({
  item,
  reflection,
  plan,
  resources,
  busy,
  insertState = null,
  onInsertToPath,
  onReflect,
  onPlan,
  onResources,
  onMarkReviewed,
}: MistakeDetailProps) {
  const handlers: Record<MistakeAction, () => void> = {
    reflect: onReflect,
    plan: onPlan,
    resources: onResources,
    review: onMarkReviewed,
  };
  const reviewed = item.status === "reviewed";

  return (
    <article className="ws-card ws-scroll max-h-[calc(100dvh-250px)] space-y-5 p-5">
      <header>
        <div className="flex flex-wrap items-center gap-1.5">
          {item.concept ? <Tag tone="navy">{item.concept}</Tag> : null}
          {reviewed ? (
            <Tag tone="success">已复习</Tag>
          ) : (
            <Tag tone="warning">待复习</Tag>
          )}
        </div>
        <h2 className="mt-2.5 text-lg font-medium leading-relaxed text-[var(--ws-ink)]">
          {item.question}
        </h2>
        <dl className="mt-4 divide-y divide-[#898989]/15 border-y border-[#898989]/15 text-sm">
          <div className="grid gap-1 py-3 sm:grid-cols-[88px_1fr]">
            <dt className="text-xs text-[#898989]">你的答案</dt>
            <dd className="mt-0.5 text-slate-700">{item.answer}</dd>
          </div>
          <div className="grid gap-1 py-3 sm:grid-cols-[88px_1fr]">
            <dt className="text-xs text-[#746016]">参考要点</dt>
            <dd className="mt-0.5 text-slate-700">{item.expected}</dd>
          </div>
        </dl>
      </header>

      <div className="flex flex-wrap gap-2 border-t border-[var(--ws-line)] pt-4">
        {ACTIONS.map(({ key, label, busyLabel, icon: Icon }) => (
          <WsButton
            key={key}
            size="sm"
            variant={key === "review" ? "primary" : "outline"}
            disabled={busy !== null || (key === "review" && reviewed)}
            onClick={handlers[key]}
          >
            <Icon size={13} aria-hidden />
            {busy === key ? busyLabel : label}
          </WsButton>
        ))}
      </div>

      {!reflection && !plan && resources.length === 0 ? (
        <p className="text-sm text-slate-500">
          点击上方按钮，智能体会为这道错题生成归因分析、补救计划与针对性练习资源。
        </p>
      ) : null}

      {reflection ? (
        <section className="border-t border-[#898989]/15 pt-4">
          <div className="flex items-center gap-2">
            <h3 className="ws-eyebrow">归因结果</h3>
            <Tag tone="danger">{reflection.category}</Tag>
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-slate-700">
            {reflection.cause}
          </p>
          <p className="mt-1.5 text-sm text-slate-500">{reflection.remedial_goal}</p>
        </section>
      ) : null}

      {plan ? (
        <section className="border-t border-[#898989]/15 pt-4">
          <h3 className="ws-eyebrow">补救计划</h3>
          <ol className="mt-2.5 space-y-2.5">
            {plan.steps.map((step, index) => (
              <li key={step.task_id} className="flex gap-3 text-sm">
                <span className="ws-serif shrink-0 text-base text-[var(--ws-accent)]">
                  0{index + 1}
                </span>
                <div>
                  <p className="text-slate-700">{step.objective}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{step.rationale}</p>
                </div>
              </li>
            ))}
          </ol>
          {insertState !== null ? (
            <div className="mt-4 border-t border-dashed border-[var(--ws-line-strong)] pt-3">
              {insertState === "saved" ? (
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ws-accent)]">
                  <Route size={14} aria-hidden />
                  已插入当前学习路径，去「路径」页查看
                </p>
              ) : (
                <WsButton
                  size="sm"
                  variant="outline"
                  disabled={insertState === "saving"}
                  onClick={onInsertToPath}
                >
                  <Route size={13} aria-hidden />
                  {insertState === "saving" ? "插入中…" : "插入当前学习路径"}
                </WsButton>
              )}
            </div>
          ) : null}
        </section>
      ) : null}

      {resources.length > 0 ? (
        <section className="space-y-3">
          <h3 className="ws-eyebrow">针对性资源</h3>
          {resources.map((res) => {
            const meta = resourceMeta(res.type);
            const Icon = meta.icon;
            return (
              <div
                key={res.resource_id}
                className="border-t border-[#898989]/15 py-4"
              >
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-lg ${meta.chipClass}`}
                  >
                    <Icon size={14} aria-hidden />
                  </span>
                  <span className="font-medium text-[var(--ws-ink)]">{res.title}</span>
                  <Tag tone="neutral">{meta.label}</Tag>
                </div>
                <pre className="ws-scroll mt-3 max-h-64 whitespace-pre-wrap rounded-2xl bg-white/55 p-3 text-xs leading-relaxed text-slate-700">
                  {res.content}
                </pre>
              </div>
            );
          })}
        </section>
      ) : null}
    </article>
  );
}
