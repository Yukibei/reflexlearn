"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pin, Route } from "lucide-react";

import { WsButton } from "@/components/workspace";
import { getTodaySummary } from "@/lib/todayApi";
import { pinResourceToItem } from "@/lib/planApi";
import type { TodayLearningPathNode } from "@/lib/types";

interface PinToPathPanelProps {
  token: string;
  resourceId: string;
}

type Phase = "idle" | "loading" | "ready" | "saving" | "saved" | "empty" | "error";

/* 把当前资源显式绑定到学习路径的某个节点：发现/保存的资源 → 主动编排进路径。
   只列真实节点（item_id 非空）；已绑定本资源的节点直接标「已固定」。纯数据操作。 */
export function PinToPathPanel({ token, resourceId }: PinToPathPanelProps) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [nodes, setNodes] = useState<TodayLearningPathNode[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [savedTitle, setSavedTitle] = useState("");

  const pinnedNode = useMemo(
    () =>
      nodes.find((n) =>
        (n.resources ?? []).some((r) => r.resource_id === resourceId && r.pinned),
      ),
    [nodes, resourceId],
  );

  const realNodes = useMemo(() => nodes.filter((n) => n.item_id), [nodes]);

  const open = () => {
    if (phase !== "idle" && phase !== "error") return;
    setPhase("loading");
    getTodaySummary(token)
      .then((data) => {
        const real = data.pathNodes.filter((n) => n.item_id);
        setNodes(data.pathNodes);
        if (real.length === 0) {
          setPhase("empty");
          return;
        }
        setSelected(real[0].item_id ?? null);
        setPhase("ready");
      })
      .catch(() => setPhase("error"));
  };

  const confirm = async () => {
    if (selected === null) return;
    setPhase("saving");
    try {
      await pinResourceToItem(token, selected, resourceId);
      const node = realNodes.find((n) => n.item_id === selected);
      setSavedTitle(node?.title ?? "该节点");
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  };

  useEffect(() => {
    setPhase("idle");
  }, [resourceId]);

  if (pinnedNode) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#ffd85f]/70 bg-[#fff4c8]/70 px-3 py-2 text-sm text-[#746016]">
        <Pin size={14} aria-hidden />
        已固定到路径节点「{pinnedNode.title}」
      </div>
    );
  }

  if (phase === "saved") {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[#ffd85f]/70 bg-[#fff4c8]/70 px-3 py-2 text-sm text-[#746016]">
        <Check size={14} aria-hidden />
        已加入路径节点「{savedTitle}」
      </div>
    );
  }

  if (phase === "idle" || phase === "loading" || phase === "error") {
    return (
      <div className="flex flex-col gap-1.5">
        <WsButton variant="outline" size="sm" onClick={open} disabled={phase === "loading"}>
          <Route size={14} aria-hidden />
          {phase === "loading" ? "读取路径节点…" : "加入学习路径"}
        </WsButton>
        {phase === "error" ? (
          <span className="text-xs text-amber-600">读取失败，点击重试。</span>
        ) : null}
      </div>
    );
  }

  if (phase === "empty") {
    return (
      <p className="text-xs leading-5 text-slate-500">
        当前还没有真实学习路径节点，先在「学习路径」生成路径后再来固定资源。
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-[#898989]/15 bg-white/60 p-3">
      <span className="ws-eyebrow">绑定到节点</span>
      <select
        value={selected ?? ""}
        onChange={(e) => setSelected(Number(e.target.value))}
        className="min-w-0 flex-1 rounded-xl border border-[#898989]/20 bg-white/75 px-2.5 py-1.5 text-sm text-[var(--ws-ink)] focus:border-[#303030] focus:outline-none"
      >
        {realNodes.map((n) => (
          <option key={n.item_id} value={n.item_id ?? ""}>
            {n.title}
          </option>
        ))}
      </select>
      <WsButton
        variant="primary"
        size="sm"
        onClick={confirm}
        disabled={phase === "saving" || selected === null}
      >
        {phase === "saving" ? "固定中…" : "确认固定"}
      </WsButton>
    </div>
  );
}
