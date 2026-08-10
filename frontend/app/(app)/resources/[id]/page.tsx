"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileQuestion, FolderOpen, NotebookPen } from "lucide-react";

import { ResourceStudyActions } from "@/components/resource/ResourceStudyActions";
import { PinToPathPanel } from "@/components/resource/PinToPathPanel";
import { ResourceEmbed } from "@/components/resource/ResourceEmbed";
import { isExternalHref, viewForResource } from "@/components/resource/resourceView";
import { EmptyState, Tag } from "@/components/workspace";
import { getErrorMessage } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import {
  getResourceDetail,
  type ResourceDetail,
  type StudyStatus,
} from "@/lib/resourceDetailApi";

const STATUS_STAMP: Record<StudyStatus, { label: string; className: string }> = {
  unread: { label: "未开始", className: "text-slate-400" },
  in_progress: { label: "学习中", className: "text-[var(--ws-ink)]" },
  done: { label: "已完成", className: "text-[var(--ws-accent)]" },
  reviewed: { label: "已复盘", className: "text-[var(--ws-accent)]" },
};

export default function ResourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { auth } = useAuthSession();
  const [detail, setDetail] = useState<ResourceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getResourceDetail(auth.access_token, id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, auth.access_token]);

  if (loading) {
    return (
      <section className="ws-page mx-auto w-full max-w-4xl">
        <div className="ws-skeleton h-8 w-40" />
        <div className="ws-skeleton h-64" />
        <div className="ws-skeleton h-40" />
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="ws-page mx-auto w-full max-w-4xl">
        <BackLink />
        <EmptyState
          icon={FileQuestion}
          title="无法打开这份资源"
          description={error || "这份资源暂时不可访问。"}
        />
      </section>
    );
  }

  const { resource } = detail;
  const view = viewForResource(resource.type);
  const Icon = view.icon;
  const stamp = STATUS_STAMP[detail.study_status] ?? STATUS_STAMP.unread;

  return (
    <section className="ws-page mx-auto max-w-4xl">
      <BackLink />

      <header className="ws-card ws-rise p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <span className={`ws-stamp ${stamp.className}`}>{stamp.label}</span>
          <div className="text-right">
            <p className="ws-eyebrow">Resource Nº</p>
            <p className="ws-serif mt-0.5 text-lg tracking-[0.18em] text-[var(--ws-ink)]">
              {resource.resource_id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-start gap-4">
          <span className={`flex h-11 w-11 shrink-0 items-center justify-center ${view.tone}`}>
            <Icon size={19} aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
              <span>{resource.source_label || view.label}</span>
              {resource.provider ? <span>{resource.provider}</span> : null}
              <span>{resource.estimated_minutes} 分钟</span>
            </div>
            <h1 className="ws-serif mt-2 text-3xl leading-tight text-[var(--ws-ink)]">
              {resource.title || view.label}
            </h1>
          </div>
        </div>

        {resource.reason ? (
          <p className="mt-5 border-t border-dashed border-[var(--ws-line-strong)] pt-4 text-sm leading-6 text-slate-600">
            <span className="ws-eyebrow mr-2">Why</span>
            {resource.reason}
          </p>
        ) : null}

        <div className="mt-5">
          <ResourceStudyActions
            token={auth.access_token}
            resourceId={resource.resource_id}
            status={detail.study_status}
            onChanged={(status) => setDetail({ ...detail, study_status: status })}
          />
        </div>
        <div className="mt-4">
          <PinToPathPanel token={auth.access_token} resourceId={resource.resource_id} />
        </div>
        {detail.degraded.length > 0 ? (
          <div className="mt-4">
            <Tag tone="warning">部分记录同步中</Tag>
          </div>
        ) : null}
      </header>

      <ResourceEmbed type={resource.type} embedUrl={resource.embed_url} title={resource.title} />

      <div className="grid gap-4 sm:grid-cols-2">
        <RelatedCard
          icon={FolderOpen}
          label="所属学习目标"
          value={detail.goal_title || "未关联目标"}
          href={detail.goal_id ? `/spaces/${detail.goal_id}` : undefined}
        />
        <RelatedCard
          icon={NotebookPen}
          label="同概念待复盘错题"
          value={
            detail.related_open_mistakes > 0
              ? `${detail.related_open_mistakes} 条与「${resource.title ? resource.title.slice(0, 12) : "该概念"}」相关`
              : "暂无相关错题"
          }
          href={detail.related_open_mistakes > 0 ? "/mistakes" : undefined}
        />
      </div>

      {detail.content ? (
        <article className="ws-card ws-rise p-6" style={{ animationDelay: "120ms" }}>
          <p className="ws-eyebrow">Content</p>
          <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">
            {detail.content}
          </div>
        </article>
      ) : null}

      {isExternalHref(resource.href) ? (
        <a
          href={resource.href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--ws-accent)] hover:text-[var(--ws-ink)]"
        >
          打开外部来源
          <ExternalLink size={14} aria-hidden />
        </a>
      ) : null}
    </section>
  );
}

function BackLink() {
  return (
    <Link
      href="/resources"
      className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--ws-ink)]"
    >
      <ArrowLeft size={14} aria-hidden /> 返回资源库
    </Link>
  );
}

function RelatedCard({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: typeof FolderOpen;
  label: string;
  value: string;
  href?: string;
}) {
  const body = (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e3e5e6] text-[var(--ws-ink)]">
        <Icon size={16} aria-hidden />
      </span>
      <div>
        <p className="text-xs text-slate-500">{label}</p>
        <p className="mt-1 text-sm font-medium leading-6 text-[var(--ws-ink)]">{value}</p>
      </div>
    </div>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="ws-dashboard-card rounded-2xl p-4 transition-colors hover:bg-white/80"
      >
        {body}
      </Link>
    );
  }
  return <div className="ws-dashboard-card rounded-2xl p-4">{body}</div>;
}
