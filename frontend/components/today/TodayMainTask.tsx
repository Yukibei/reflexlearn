import Link from "next/link";
import { ArrowRight, Clock3, MessageCircleQuestion, SlidersHorizontal } from "lucide-react";

import type { TodayTask } from "./types";

type TodayMainTaskProps = {
  task: TodayTask;
  primaryHref?: string;
  secondaryActions: readonly {
    label: string;
    href: string;
    icon: "explain" | "adjust";
  }[];
};

const ACTION_ICONS = {
  explain: MessageCircleQuestion,
  adjust: SlidersHorizontal,
} as const;

export function TodayMainTask({
  task,
  primaryHref = "/chat",
  secondaryActions,
}: TodayMainTaskProps) {
  return (
    <article className="group relative min-h-[390px] overflow-hidden rounded-3xl shadow-[0_2px_20px_rgb(0_0_0/0.10)] lg:h-full lg:min-h-0">
      <img
        src="https://images.pexels.com/photos/18105/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=900"
        alt="桌面上的笔记本电脑，表示当前学习任务"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,15,15,0.92)_0%,rgba(15,15,15,0.52)_58%,rgba(15,15,15,0.08)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[62%] bg-black/10 backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_58%,transparent_100%)]" />
      <Link
        href={primaryHref}
        aria-label={`${task.primaryAction}：${task.title}`}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#ffd85f]"
      />

      <div className="pointer-events-none relative z-20 flex h-full min-h-[390px] flex-col justify-between p-5 text-white lg:min-h-0">
        <div className="flex items-center justify-between gap-3">
          <span className="max-w-[70%] truncate rounded-full border border-white/25 bg-white/[0.12] px-3 py-1.5 text-xs backdrop-blur-xl">
            {task.spaceName || "当前学习目标"}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/[0.12] px-3 py-1.5 text-xs backdrop-blur-xl">
            <Clock3 size={13} aria-hidden />
            {task.estimatedMinutes} 分钟
          </span>
        </div>

        <div>
          <p className="text-xs text-white/62">{task.pathNode || "当前节点"}</p>
          <h2 className="mt-2 text-pretty text-2xl font-medium leading-tight sm:text-3xl">
            {task.title}
          </h2>
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-white/72">{task.reason}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center justify-center gap-2 rounded-full bg-[#ffd85f] px-4 py-2.5 text-sm font-medium text-[#303030] transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              {task.primaryAction}
              <ArrowRight size={15} aria-hidden />
            </span>
            {secondaryActions.map((action) => {
              const Icon = ACTION_ICONS[action.icon];
              return (
                <Link
                  key={action.label}
                  href={action.href}
                  aria-label={action.label}
                  title={action.label}
                  className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <Icon size={16} aria-hidden />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </article>
  );
}
