import { Clock3, Library, Route } from "lucide-react";
import Link from "next/link";

type TodayHeroProps = {
  greeting: string;
  learner: string;
  goal: string;
  summary: string;
  progress: number;
  pathCount: number;
  resourceCount: number;
  reviewCount: number;
  totalMinutes: number;
};

export function TodayHero({
  greeting,
  learner,
  goal,
  summary,
  progress,
  pathCount,
  resourceCount,
  reviewCount,
  totalMinutes,
}: TodayHeroProps) {
  const percent = Math.round(progress * 100);
  const segments = [
    { label: "已完成", value: `${percent}%`, href: "/plan", flex: 15, className: "bg-[#303030] text-white" },
    { label: "当前节点", value: "进行中", href: "/plan", flex: 15, className: "bg-[#ffd85f] text-[#303030]" },
    { label: "学习主线", value: goal, href: "/spaces", flex: 60, className: "border border-[#d7d7d2] text-[#303030]" },
    { label: "待复习", value: String(reviewCount), href: "/mistakes", flex: 10, className: "border border-[#898989]/35 bg-white/55 text-[#303030]" },
  ];
  const stats = [
    { label: "路径节点", value: pathCount, href: "/plan", icon: Route },
    { label: "学习资源", value: resourceCount, href: "/resources", icon: Library },
    { label: "预计分钟", value: totalMinutes, href: "/plan", icon: Clock3 },
  ];

  return (
    <header className="grid gap-5 pb-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(380px,0.8fr)] lg:items-end">
      <div className="min-w-0">
        <p className="text-sm text-[#626262]">{learner}</p>
        <h1 className="mt-2 max-w-4xl text-pretty text-3xl font-medium leading-[1.08] tracking-normal text-[#303030] sm:text-4xl lg:text-5xl">
          {greeting}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[#626262] sm:text-base">
          {summary}
        </p>

        <div className="mt-5 flex w-full gap-1.5" aria-label={`当前目标：${goal}`}>
          {segments.map((segment) => (
            <div key={segment.label} className="min-w-0" style={{ flex: segment.flex }}>
              <p className="mb-1 truncate text-center text-[10px] text-[#626262] sm:text-xs">{segment.label}</p>
              <Link
                href={segment.href}
                className={`flex h-9 items-center justify-center truncate rounded-full px-2.5 py-2 text-center text-[10px] transition hover:-translate-y-px sm:text-xs ${segment.className}`}
                style={
                  segment.label === "学习主线"
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(-45deg,#e5e5e5 0,#e5e5e5 2px,#f5f5f5 2px,#f5f5f5 10px)",
                      }
                    : undefined
                }
                title={segment.value}
              >
                {segment.value}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Link
              key={stat.label}
              href={stat.href}
              className="group min-w-0 rounded-2xl px-2 py-2 text-center transition hover:bg-white/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/25"
            >
              <span className="mb-2 inline-flex rounded-lg bg-[#898989]/15 p-1.5 text-[#747474]">
                <Icon size={14} aria-hidden />
              </span>
              <span className="block truncate text-3xl font-medium leading-none tabular-nums text-[#303030] sm:text-4xl lg:text-5xl">
                {stat.value}
              </span>
              <span className="mt-1 block text-xs text-[#626262]">{stat.label}</span>
            </Link>
          );
        })}
      </div>
    </header>
  );
}
