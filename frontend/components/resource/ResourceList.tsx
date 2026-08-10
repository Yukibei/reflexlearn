import Link from "next/link";
import { ExternalLink } from "lucide-react";

import type { LearningResource } from "@/lib/types";
import { isExternalHref, viewForResource } from "./resourceView";

interface ResourceListProps {
  resources: LearningResource[];
}

export function ResourceList({ resources }: ResourceListProps) {
  return (
    <div className="ws-scroll grid max-h-[620px] gap-3 pr-1 md:grid-cols-2">
      {resources.map((item) => (
        <ResourceCard key={item.resource_id} item={item} />
      ))}
    </div>
  );
}

function ResourceCard({ item }: { item: LearningResource }) {
  const view = viewForResource(item.type);
  const Icon = view.icon;
  const source = item.source_label || view.label;

  return (
    <article className="ws-dashboard-card rounded-3xl p-5 transition hover:bg-white/80">
      <div className="flex items-start gap-4">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${view.tone}`}>
          <Icon size={18} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{source}</span>
            {item.provider ? <span>{item.provider}</span> : null}
            <span>{item.estimated_minutes} 分钟</span>
            {item.embed_url ? <span>可站内播放</span> : null}
          </div>
          <h3 className="mt-2 text-base font-medium text-[var(--ws-ink)]">
            <Link
              href={`/resources/${encodeURIComponent(item.resource_id)}`}
              className="transition-colors hover:text-[var(--ws-accent)]"
            >
              {item.title || view.label}
            </Link>
          </h3>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600">
            {item.reason || item.content_preview || "与当前学习目标相关。"}
          </p>
          {item.source_policy === "embed_or_redirect_only" ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              外部平台内容仅通过来源链接或允许的嵌入方式访问。
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-4">
        <Link
          href={`/resources/${encodeURIComponent(item.resource_id)}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ws-accent)] hover:text-[var(--ws-ink)]"
        >
          查看详情
        </Link>
        {isExternalHref(item.href) ? (
          <a
            href={item.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-[var(--ws-ink)]"
          >
            打开来源
            <ExternalLink size={14} aria-hidden />
          </a>
        ) : null}
      </div>
    </article>
  );
}
