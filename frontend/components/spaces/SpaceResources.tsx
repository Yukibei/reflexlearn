import {
  BookOpenText,
  ChevronDown,
  ClipboardCheck,
  Code2,
  FileText,
  MessagesSquare,
  Network,
  PlaySquare,
} from "lucide-react";

import type { SpaceResource } from "@/lib/types";

const RESOURCE_META = {
  doc: { label: "讲解文档", icon: FileText },
  ai_document: { label: "AI 讲解文档", icon: FileText },
  quiz: { label: "针对练习", icon: ClipboardCheck },
  code: { label: "代码案例", icon: Code2 },
  reading: { label: "阅读材料", icon: BookOpenText },
  video: { label: "视频资源", icon: PlaySquare },
  external_video: { label: "外部视频", icon: PlaySquare },
  official_doc: { label: "官方资料", icon: BookOpenText },
  oer: { label: "开放课程", icon: BookOpenText },
  user_upload: { label: "个人资料", icon: FileText },
  mindmap: { label: "思维导图", icon: Network },
  debate: { label: "观点辨析", icon: MessagesSquare },
} as const;

/* 资源按类型归档成卷宗：避免几十条资源平铺成后台表格 */
export function SpaceResources({ resources }: { resources: SpaceResource[] }) {
  const groups = groupByType(resources);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="ws-eyebrow">
            Resources
          </p>
          <h2 className="mt-2 text-xl font-medium text-[var(--ws-ink)]">这个目标下的学习资源</h2>
        </div>
        {resources.length > 0 ? (
          <p className="text-xs text-slate-500">
            共 {resources.length} 份 · 按类型归档，点击分组展开
          </p>
        ) : null}
      </div>

      {resources.length === 0 ? (
        <div className="ws-dashboard-card px-5 py-6 text-sm leading-6 text-[#747474]">
          这个空间还没有沉淀资源。完成一次讲解、练习或资料上传后，会在这里形成可回看的资源列表。
        </div>
      ) : (
        <div className="space-y-3 pr-1">
          {groups.map((group, index) => {
            const Icon = group.meta.icon;
            return (
              <details
                key={group.type}
                open={index === 0}
                className="ws-dashboard-card group overflow-hidden rounded-3xl"
              >
                <summary className="flex cursor-pointer select-none items-center gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3e5e6] text-[var(--ws-ink)]">
                    <Icon size={16} aria-hidden />
                  </span>
                  <span className="flex-1 font-medium text-[var(--ws-ink)]">{group.meta.label}</span>
                  <span className="ws-serif text-lg text-slate-400">{group.items.length}</span>
                  <ChevronDown
                    size={16}
                    aria-hidden
                    className="text-slate-400 transition-transform group-open:rotate-180"
                  />
                </summary>
                <div className="divide-y divide-[var(--ws-line)] border-t border-[var(--ws-line)]">
                  {group.items.map((resource) => (
                    <ResourceRow key={resource.resource_id} resource={resource} />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ResourceRow({ resource }: { resource: SpaceResource }) {
  return (
    <article className="grid gap-2 px-4 py-4 md:grid-cols-[1fr_110px]">
      <div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {resource.concept ? <span>{resource.concept}</span> : null}
        </div>
        <h3 className="mt-1 text-sm font-medium leading-6 text-[var(--ws-ink)]">
          {resource.title || resourceMeta(resource.type).label}
        </h3>
        {resource.content ? (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-600">{resource.content}</p>
        ) : null}
      </div>
      <div className="flex items-start md:justify-end">
        <span className="text-xs text-slate-500">
          {resource.quality_score != null
            ? `匹配度 ${Math.round(resource.quality_score * 100)}%`
            : "已归档"}
        </span>
      </div>
    </article>
  );
}

function groupByType(resources: SpaceResource[]) {
  const map = new Map<string, SpaceResource[]>();
  for (const item of resources) {
    const list = map.get(item.type) ?? [];
    list.push(item);
    map.set(item.type, list);
  }
  return [...map.entries()]
    .map(([type, items]) => ({ type, items, meta: resourceMeta(type) }))
    .sort((a, b) => b.items.length - a.items.length);
}

function resourceMeta(type: string): { label: string; icon: typeof FileText } {
  return RESOURCE_META[type as keyof typeof RESOURCE_META] ?? { label: "学习资源", icon: FileText };
}
