import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { PlanTaskList } from "@/components/agent-ui/PlanTaskList";
import type { LearningPath } from "@/lib/types";

const TYPE_LABEL: Record<string, string> = {
  doc: "讲解文档",
  quiz: "练习题",
  mindmap: "思维导图",
  code: "代码案例",
  reading: "拓展阅读",
  video: "多模态视频",
  debate: "辩论结论",
};

export function LearningPathCard({ path }: { path: LearningPath }) {
  if (!path?.steps || path.steps.length === 0) return null;

  const items = path.steps.map((step) => ({
    id: `${step.sequence}-${step.task_id}`,
    label: step.concept || step.objective || `第 ${step.sequence} 步`,
    meta: TYPE_LABEL[step.resource_type] || step.resource_type,
  }));

  return (
    <section className="max-w-[680px] space-y-2">
      <PlanTaskList items={items} />
      <div className="flex items-start justify-between gap-4 px-1 text-xs leading-5 text-[#747474]">
        <p className="line-clamp-2 max-w-[80%]">{path.summary || path.strategy}</p>
        <Link
          href="/plan"
          className="inline-flex shrink-0 items-center gap-1 text-[#303030] transition hover:text-[#77621d]"
        >
          完整路径
          <ArrowUpRight size={12} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
