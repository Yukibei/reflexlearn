"use client";

import { ArrowUpRight, CalendarRange, Focus, Gauge } from "lucide-react";

interface TutorEmptyStateProps {
  disabled: boolean;
  goal: string;
  weakPoint: string;
  onSelect: (message: string, displayMessage?: string) => void;
}

export function TutorEmptyState({
  disabled,
  goal,
  weakPoint,
  onSelect,
}: TutorEmptyStateProps) {
  const actions = [
    {
      icon: Gauge,
      label: "诊断当前基础",
      detail: "用几个递进问题判断掌握程度",
      prompt: `围绕我的当前目标“${goal}”进行一次简短的基础诊断。请逐次提出 3 到 5 个递进问题，等我回答后再判断掌握程度、知识缺口和下一步。`,
    },
    {
      icon: Focus,
      label: "解释当前薄弱点",
      detail: weakPoint,
      prompt: `请结合我的学习目标“${goal}”，解释当前薄弱点“${weakPoint}”。先用直观例子建立理解，再给出关键知识、常见误区和一道用于自测的小题。`,
    },
    {
      icon: CalendarRange,
      label: "规划本周学习",
      detail: "形成每天可执行、可检查的安排",
      prompt: `请围绕学习目标“${goal}”和薄弱点“${weakPoint}”，为我规划未来 7 天的学习安排。每天包含目标、学习动作、练习和验收标准，并控制在可执行的工作量内。`,
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col justify-center py-2 sm:py-4">
      <p className="ws-eyebrow">从你的学习上下文开始</p>
      <h3 className="mt-1.5 max-w-2xl text-lg font-medium leading-7 text-[#303030] sm:text-xl">
        牛牛已经读过今日目标和学习画像，可以直接开始一项具体任务。
      </h3>
      <p className="mt-2 max-w-2xl text-sm leading-5 text-[#747474]">
        你也可以在下方输入自己的问题，导师会沿用同一份学习上下文继续对话。
      </p>

      <div className="mt-5 grid divide-y divide-[#898989]/15 border-y border-[#898989]/15 md:grid-cols-3 md:divide-x md:divide-y-0">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(action.prompt, action.label)}
              className="group flex min-h-28 flex-col items-start py-4 text-left transition-colors hover:bg-white/45 disabled:cursor-not-allowed disabled:opacity-50 md:px-4 md:first:pl-0 md:last:pr-0"
            >
              <span className="flex w-full items-center justify-between text-[#77621d]">
                <Icon size={18} aria-hidden />
                <ArrowUpRight
                  size={15}
                  className="text-[#898989] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#303030]"
                  aria-hidden
                />
              </span>
              <span className="mt-3 text-sm font-medium text-[#303030]">
                {action.label}
              </span>
              <span className="mt-1 line-clamp-2 text-xs leading-5 text-[#747474]">
                {action.detail}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
