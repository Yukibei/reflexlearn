"use client";

import { useCallback, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { FileUp } from "lucide-react";
import { apiForm, getErrorMessage } from "@/lib/apiClient";
import type { IngestResult } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "/api";

type Status = "idle" | "uploading" | "done" | "error";

interface KnowledgeUploadProps {
  token: string;
}

/** M4-F 知识库文档上传：拖拽/选择文件 → POST /api/knowledge/upload → 可视化 IngestResult。 */
export function KnowledgeUpload({ token }: KnowledgeUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [result, setResult] = useState<IngestResult | null>(null);
  const [error, setError] = useState("");
  const [courseId, setCourseId] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [graphBuild, setGraphBuild] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const upload = useCallback(async () => {
    if (!file) return;
    setStatus("uploading");
    setError("");
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("course_id", courseId);
      fd.append("visibility", visibility);
      fd.append("enable_graph_build", String(graphBuild));
      const data = await apiForm<IngestResult>(`${API_BASE}/knowledge/upload`, token, fd);
      setResult(data);
      setStatus("done");
    } catch (e: unknown) {
      setError(getErrorMessage(e));
      setStatus("error");
    }
  }, [file, courseId, visibility, graphBuild, token]);

  const onDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  }, []);

  return (
    <div className="space-y-3">
      <h3 className="flex items-center gap-2 text-sm font-medium text-[#303030]">
        <FileUp size={15} aria-hidden /> 知识库文档上传
      </h3>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center text-sm transition ${
          dragging
            ? "border-[#ffd85f] bg-[#fff4c8]/70 text-[#746016]"
            : "border-[#898989]/25 bg-white/35 text-[#747474] hover:border-[#303030]/35"
        }`}
      >
        {file ? (
          <span className="font-medium text-slate-700">{file.name}</span>
        ) : (
          <span>拖拽文件到此，或点击选择（pdf / docx / pptx / html / md / txt）</span>
        )}
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".pdf,.docx,.pptx,.html,.htm,.md,.txt"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <input
          value={courseId}
          onChange={(e) => setCourseId(e.target.value)}
          placeholder="course_id（可选）"
          className="rounded-xl border border-[#898989]/20 bg-white/70 px-2.5 py-1.5"
        />
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className="rounded-xl border border-[#898989]/20 bg-white/70 px-2.5 py-1.5"
        >
          <option value="public">public</option>
          <option value="tenant">tenant</option>
          <option value="private">private</option>
        </select>
        <label className="flex items-center gap-1 text-slate-600">
          <input
            type="checkbox"
            checked={graphBuild}
            onChange={(e) => setGraphBuild(e.target.checked)}
          />
          构建知识图谱
        </label>
        <button
          onClick={upload}
          disabled={!file || status === "uploading"}
          className="ml-auto rounded-full bg-[#ffd85f] px-4 py-2 font-medium text-[#303030] transition hover:bg-[#ffe38b] disabled:opacity-40"
        >
          {status === "uploading" ? "上传中…" : "上传"}
        </button>
      </div>

      {status === "error" && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {result && <IngestResultPanel result={result} />}
    </div>
  );
}

function IngestResultPanel({ result }: { result: IngestResult }) {
  if (result.status === "queued") {
    return (
      <div className="rounded-2xl border border-[#ffd85f]/70 bg-[#fff4c8]/70 p-3 text-sm text-[#746016]">
        已投递异步处理队列（Kafka）· doc_id <code className="text-xs">{result.doc_id}</code>
      </div>
    );
  }
  const stat = (label: string, value: ReactNode) => (
    <div className="border-l border-[#898989]/20 pl-2">
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="text-sm font-semibold text-slate-700">{value}</div>
    </div>
  );
  const badge =
    result.status === "ok"
      ? "bg-[#303030] text-white"
      : result.status === "degraded"
        ? "bg-[#ffd85f] text-[#303030]"
        : "bg-[#898989] text-white";
  return (
    <div className="space-y-2 rounded-2xl border border-[#898989]/15 bg-white/45 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}>
          {result.status}
        </span>
        <span className="text-sm font-medium text-slate-700">{result.title}</span>
        <span className="text-xs text-slate-400">{result.format}</span>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {stat("分块", result.chunks)}
        {stat("向量化", result.embedded)}
        {stat("Qdrant", result.qdrant_written)}
        {stat("PG", result.pg_written ? "✓" : "—")}
        {stat("图谱", result.graph)}
        {stat("概念", result.graph_concepts)}
        {stat("关系", result.graph_relations)}
      </div>
      {result.degraded?.length > 0 && (
        <div className="text-xs text-amber-600">降级：{result.degraded.join("、")}</div>
      )}
    </div>
  );
}
