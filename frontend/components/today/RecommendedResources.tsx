import Link from "next/link";
import {
  ArrowUpRight,
  BookOpenText,
  ClipboardCheck,
  FileText,
  PlaySquare,
  type LucideIcon,
} from "lucide-react";

import type { TodayResource } from "./types";

const RESOURCE_ICONS: Record<TodayResource["type"], LucideIcon> = {
  external_video: PlaySquare,
  ai_document: FileText,
  quiz: ClipboardCheck,
  official_doc: BookOpenText,
  oer: BookOpenText,
  user_upload: FileText,
};

type RecommendedResourcesProps = {
  resources: TodayResource[];
};

function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}

function resolveResourceHref(resource: TodayResource): string {
  if (resource.href === "/resources" && !resource.id.startsWith("fallback-")) {
    return `/resources/${encodeURIComponent(resource.id)}`;
  }
  return resource.href;
}

function ResourceRow({ resource, index }: { resource: TodayResource; index: number }) {
  const Icon = RESOURCE_ICONS[resource.type];
  const href = resolveResourceHref(resource);
  const className =
    "group flex min-w-0 items-center gap-3 rounded-2xl py-3 transition-colors hover:bg-white/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/30";
  const label = `打开资源：${resource.title}`;
  const content = (
    <>
      <div className="w-11 shrink-0 text-center">
        <p className="text-lg font-medium tabular-nums text-[#303030]">
          {resource.estimatedMinutes}
        </p>
        <p className="text-[10px] text-[#747474]">分钟</p>
      </div>
      <span
        className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          index === 0 ? "bg-[#303030] text-white" : "bg-[#ffd85f] text-[#303030]"
        }`}
      >
        <Icon size={15} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-xs text-[#747474]" title={resource.sourceLabel}>
          {resource.sourceLabel}
        </p>
        <h3 className="mt-0.5 block max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-sm font-medium text-[#303030]" title={resource.title}>
          {resource.title}
        </h3>
      </div>
      <span className="mr-[5px] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#898989]/20 text-[#303030] transition-colors group-hover:bg-[#ffd85f]">
        <ArrowUpRight size={14} aria-hidden />
      </span>
    </>
  );
  if (isExternalHref(href)) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={className}>
        {content}
      </a>
    );
  }
  return (
    <Link href={href} aria-label={label} title={label} className={className}>
      {content}
    </Link>
  );
}

export function RecommendedResources({ resources }: RecommendedResourcesProps) {
  return (
    <section className="ws-dashboard-card flex min-h-[320px] flex-col p-5 lg:h-full lg:min-h-0">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-[#747474]">学习资源</p>
          <h2 className="mt-1 text-lg font-medium text-[#303030]">今日资源安排</h2>
        </div>
        <Link
          href="/resources"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#898989]/25 bg-white/35 px-3 py-1.5 text-xs text-[#303030] transition-colors hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/25"
        >
          查看全部
          <ArrowUpRight size={13} aria-hidden />
        </Link>
      </header>

      {resources.length > 0 ? (
        <ol className="mt-4 grid min-h-0 flex-1 gap-x-5 sm:grid-cols-2">
          {resources.slice(0, 4).map((resource, index) => {
            return (
              <li key={resource.id} className="border-t border-[#898989]/15">
                <ResourceRow resource={resource} index={index} />
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-4 flex flex-1 items-center justify-center rounded-2xl border border-dashed border-[#898989]/30 px-4 text-center text-sm text-[#747474]">
          完成一次学习规划后，推荐资源会排入这里。
        </div>
      )}
    </section>
  );
}
