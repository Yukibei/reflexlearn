"use client";

import { useState } from "react";
import { BookmarkCheck, BookmarkPlus, ExternalLink, Sparkles } from "lucide-react";

import { saveCandidate, type ResourceCandidate } from "@/lib/resourceDiscoveryApi";
import { isExternalHref, viewForResource } from "./resourceView";

interface ResourceCandidatesProps {
  candidates: ResourceCandidate[];
  token: string;
  onSaved?: () => void;
}

type SaveState = "idle" | "saving" | "saved" | "error";

export function ResourceCandidates({ candidates, token, onSaved }: ResourceCandidatesProps) {
  const [states, setStates] = useState<Record<string, SaveState>>({});

  if (candidates.length === 0) return null;

  const save = async (candidate: ResourceCandidate) => {
    setStates((prev) => ({ ...prev, [candidate.resource_id]: "saving" }));
    try {
      await saveCandidate(token, candidate);
      setStates((prev) => ({ ...prev, [candidate.resource_id]: "saved" }));
      onSaved?.();
    } catch {
      setStates((prev) => ({ ...prev, [candidate.resource_id]: "error" }));
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <p className="ws-eyebrow">
          候选资源
        </p>
        <h2 className="mt-2 text-xl font-medium text-[var(--ws-ink)]">发现到的候选资源</h2>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          看准了就保存进资源库，它会进入今日学习和路径推荐的循环。
        </p>
      </div>
        <div className="ws-scroll grid max-h-[580px] gap-3 pr-1 lg:grid-cols-3">
        {candidates.map((item) => {
          const view = viewForResource(item.type);
          const Icon = view.icon;
          const state = states[item.resource_id] ?? "idle";
          return (
            <article key={item.resource_id} className="ws-dashboard-card flex flex-col rounded-3xl p-4">
              <div className="flex items-start justify-between gap-3">
                <span className={`flex h-9 w-9 items-center justify-center ${view.tone}`}>
                  <Icon size={16} aria-hidden />
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                  <Sparkles size={12} aria-hidden />
                  {Math.round(item.rank_score * 100)}%
                </span>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span>{item.source_label}</span>
                <span>{item.provider}</span>
                <span>{item.estimated_minutes} 分钟</span>
              </div>
              <h3 className="mt-2 text-sm font-medium leading-6 text-[var(--ws-ink)]">
                {item.title}
              </h3>
              <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-600">{item.reason}</p>
              <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
                <SaveButton state={state} onClick={() => save(item)} />
                {isExternalHref(item.href) ? (
                  <a
                    href={item.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ws-accent)] hover:text-[var(--ws-ink)]"
                  >
                    打开来源
                    <ExternalLink size={14} aria-hidden />
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function SaveButton({ state, onClick }: { state: SaveState; onClick: () => void }) {
  if (state === "saved") {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--ws-accent)]">
        <BookmarkCheck size={15} aria-hidden />
        已入资源库
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === "saving"}
      className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#303030] px-3.5 text-sm font-medium text-white transition hover:bg-[#4a4a4a] disabled:opacity-50"
    >
      <BookmarkPlus size={15} aria-hidden />
      {state === "saving" ? "保存中…" : state === "error" ? "重试保存" : "保存到资源库"}
    </button>
  );
}
