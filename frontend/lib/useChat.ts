"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";
import { parseSSEStream } from "./sse";
import type {
  AgentStep,
  DebateRound,
  JudgeVerdict,
  LearningPath,
  ResourceCard,
  ResourceDelta,
} from "./types";

export type ChatStatus = "idle" | "streaming" | "done" | "error";

const SID_KEY = "reflexlearn_sid";

export interface Turn {
  id: number;
  userMessage: string;
  status: ChatStatus;
  startedAt: number;
  durationMs: number | null;
  steps: AgentStep[];
  cards: Map<string, ResourceCard>;
  debateRounds: DebateRound[];
  verdict: JudgeVerdict | null;
  path: LearningPath | null;
  assistantMessage: string;
  error: string | null;
}

type Action =
  | { type: "start"; message: string; displayMessage?: string }
  | { type: "agent_step"; payload: AgentStep }
  | { type: "resource_card"; payload: ResourceCard }
  | { type: "resource_delta"; payload: ResourceDelta }
  | { type: "debate_round"; payload: DebateRound }
  | { type: "judge_verdict"; payload: JudgeVerdict }
  | { type: "learning_path"; payload: LearningPath }
  | { type: "assistant_message"; payload: string }
  | { type: "done" }
  | { type: "error"; payload: string }
  | { type: "reset" };

function newTurn(id: number, message: string, displayMessage?: string): Turn {
  return {
    id,
    userMessage: displayMessage || message,
    status: "streaming",
    startedAt: Date.now(),
    durationMs: null,
    steps: [],
    cards: new Map(),
    debateRounds: [],
    verdict: null,
    path: null,
    assistantMessage: "",
    error: null,
  };
}

// 多轮累积：每次仅更新最后一个 turn（当前进行中的轮次），历史 turn 不可变保留
function updateLast(turns: Turn[], fn: (t: Turn) => Turn): Turn[] {
  if (turns.length === 0) return turns;
  const copy = turns.slice();
  copy[copy.length - 1] = fn(copy[copy.length - 1]);
  return copy;
}

function reducer(turns: Turn[], action: Action): Turn[] {
  switch (action.type) {
    case "start":
      return [...turns, newTurn(turns.length, action.message, action.displayMessage)];
    case "agent_step":
      return updateLast(turns, (t) => ({ ...t, steps: [...t.steps, action.payload] }));
    case "resource_card":
      return updateLast(turns, (t) => {
        const cards = new Map(t.cards);
        // 生成阶段与 assemble 阶段会重复 emit 同一卡片，按 task_id 去重（后到的更完整、覆盖前者）
        const key = action.payload.task_id || `card-${cards.size}`;
        cards.set(key, { ...action.payload, streaming: false });
        return { ...t, cards };
      });
    case "resource_delta":
      return updateLast(turns, (t) => {
        const cards = new Map(t.cards);
        // 逐 token 增量累积成「流式卡片」，末帧 resource_card 落定后覆盖为完整内容。
        const key = action.payload.task_id || `card-${cards.size}`;
        const prev = cards.get(key);
        const base = action.payload.reset || !prev ? "" : prev.content;
        cards.set(key, {
          type: action.payload.type || prev?.type || "doc",
          task_id: action.payload.task_id,
          content: base + action.payload.delta,
          streaming: true,
        });
        return { ...t, cards };
      });
    case "debate_round":
      return updateLast(turns, (t) => ({
        ...t,
        debateRounds: [...t.debateRounds, action.payload],
      }));
    case "judge_verdict":
      return updateLast(turns, (t) => ({ ...t, verdict: action.payload }));
    case "learning_path":
      return updateLast(turns, (t) => ({ ...t, path: action.payload }));
    case "assistant_message":
      return updateLast(turns, (t) => ({ ...t, assistantMessage: action.payload }));
    case "done":
      return updateLast(turns, (t) =>
        t.status === "streaming"
          ? { ...t, status: "done", durationMs: Date.now() - t.startedAt }
          : t,
      );
    case "error":
      return updateLast(turns, (t) => ({
        ...t,
        status: "error",
        error: action.payload,
        durationMs: Date.now() - t.startedAt,
      }));
    case "reset":
      return [];
    default:
      return turns;
  }
}

function getErrorMessage(e: unknown): string {
  return e instanceof Error ? e.message : "连接出错";
}

function isAbortError(e: unknown): boolean {
  return e instanceof DOMException
    ? e.name === "AbortError"
    : e instanceof Error && e.name === "AbortError";
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getStoredChatSession(): string {
  if (typeof window === "undefined") return "";
  window.localStorage.removeItem(SID_KEY);
  return window.sessionStorage.getItem(SID_KEY) || "";
}

function storeChatSession(sessionId: string): void {
  if (typeof window === "undefined" || !sessionId) return;
  window.sessionStorage.setItem(SID_KEY, sessionId);
}

export function clearStoredChatSession(): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(SID_KEY);
  window.localStorage.removeItem(SID_KEY);
}

export function useChat(token: string) {
  const [turns, dispatch] = useReducer(reducer, []);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<string>("");

  // 初始化：只从当前浏览器会话恢复 sid，避免登出/换号后跨账号沿用。
  useEffect(() => {
    sessionRef.current = getStoredChatSession();
  }, []);

  const send = useCallback(async (message: string, displayMessage?: string) => {
    if (!message.trim()) return;
    abortRef.current?.abort(); // 取消上一次未完成的流，避免事件串台
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    dispatch({ type: "start", message, displayMessage });

    const base = process.env.NEXT_PUBLIC_API_BASE || "/api";
    let errored = false;
    try {
      for await (const msg of parseSSEStream(
        `${base}/chat`,
        { message, session_id: sessionRef.current },
        ctrl.signal,
        token,
      )) {
        switch (msg.event) {
          case "session": {
            // 首帧回传 session_id：存 ref + sessionStorage，下一轮带回延续多轮
            const data = asRecord(msg.data);
            sessionRef.current = asString(data.session_id) || sessionRef.current;
            storeChatSession(sessionRef.current);
            break;
          }
          case "agent_step":
            dispatch({ type: "agent_step", payload: msg.data as AgentStep });
            break;
          case "resource_card":
            dispatch({ type: "resource_card", payload: msg.data as ResourceCard });
            break;
          case "resource_delta":
            dispatch({ type: "resource_delta", payload: msg.data as ResourceDelta });
            break;
          case "debate_round":
            dispatch({ type: "debate_round", payload: msg.data as DebateRound });
            break;
          case "judge_verdict":
            dispatch({ type: "judge_verdict", payload: msg.data as JudgeVerdict });
            break;
          case "learning_path":
            dispatch({ type: "learning_path", payload: msg.data as LearningPath });
            break;
          case "assistant_message": {
            const data = asRecord(msg.data);
            dispatch({ type: "assistant_message", payload: asString(data.content) });
            break;
          }
          case "error": {
            const data = asRecord(msg.data);
            errored = true;
            dispatch({ type: "error", payload: asString(data.error) || "服务端出错" });
            break;
          }
          case "done":
            dispatch({ type: "done" });
            break;
        }
      }
      if (!errored) dispatch({ type: "done" }); // 流自然结束但未显式 done 时兜底
    } catch (e: unknown) {
      if (!isAbortError(e)) {
        dispatch({ type: "error", payload: getErrorMessage(e) });
      }
    }
  }, [token]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "done" });
  }, []);

  // 新会话：中断当前流、清空历史 turns、丢弃 session_id（后端下次生成新 sid）
  const resetSession = useCallback(() => {
    abortRef.current?.abort();
    sessionRef.current = "";
    clearStoredChatSession();
    dispatch({ type: "reset" });
  }, []);

  const streaming =
    turns.length > 0 && turns[turns.length - 1].status === "streaming";

  return { turns, send, stop, resetSession, streaming };
}
