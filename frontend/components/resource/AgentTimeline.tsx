import type { AgentStep } from "@/lib/types";
import { ThinkingReasoning } from "@/components/chat/ThinkingReasoning";

const STEP_LABEL: Record<string, string> = {
  session_start: "会话开始",
  profile: "构建学习画像",
  planner: "规划资源任务",
  gate: "验收裁决",
  critic: "失败归因 / 重规划",
  pipeline: "流水线协作生成",
  assemble: "组装资源包",
  path_plan: "规划学习路径",
};

export function AgentTimeline({
  steps,
  streaming,
  durationMs,
}: {
  steps: AgentStep[];
  streaming: boolean;
  durationMs: number | null;
}) {
  const items = steps.map((step) => {
    const label = STEP_LABEL[step.step] || step.step;
    const detail = step.detail || step.message;
    return detail ? `${label}：${detail}` : label;
  });

  return <ThinkingReasoning items={items} active={streaming} durationMs={durationMs} />;
}
