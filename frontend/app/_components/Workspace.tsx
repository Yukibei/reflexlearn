"use client";

import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { ArrowDown } from "lucide-react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";
import type { CurrentUser } from "@/lib/types";
import { useChat } from "@/lib/useChat";
import { cn } from "@/lib/utils";
import type { TutorRuntimeStatus, WorkspaceRuntimeState } from "@/components/chat/tutorRuntime";
import { ChatInput } from "@/components/chat/ChatInput";
import { AgentTimeline } from "@/components/resource/AgentTimeline";
import { MarkdownView } from "@/components/cards/MarkdownView";
import { ResourceCard } from "@/components/resource/ResourceCard";
import { DebatePanel } from "@/components/resource/DebatePanel";
import { LearningPathCard } from "@/components/resource/LearningPathCard";
import { KnowledgeUpload } from "@/components/tools/KnowledgeUpload";
import { VideoJobCard } from "@/components/tools/VideoJobCard";

interface WorkspaceActionContext {
  disabled: boolean;
  onSelect: (message: string, displayMessage?: string) => void;
}

interface WorkspaceProps {
  token: string;
  user: CurrentUser;
  onLogout: () => void;
  embedded?: boolean;
  emptyState?: ReactNode | ((context: WorkspaceActionContext) => ReactNode);
  showTools?: boolean;
  initialMessage?: string;
  initialDisplayMessage?: string;
  actionBar?: (context: WorkspaceActionContext) => ReactNode;
  className?: string;
  onStateChange?: (state: WorkspaceRuntimeState) => void;
  conversationAddon?: ReactNode;
  onReset?: () => void;
}

export function Workspace({
  token,
  user,
  onLogout,
  embedded = false,
  emptyState,
  actionBar,
  showTools = true,
  initialMessage,
  initialDisplayMessage,
  className,
  onStateChange,
  conversationAddon,
  onReset,
}: WorkspaceProps) {
  const { turns, send, stop, resetSession, streaming } = useChat(token);
  const sentInitialRequest = useRef("");

  useEffect(() => {
    if (!initialMessage) return;
    const requestKey = `${initialDisplayMessage ?? ""}\n${initialMessage}`;
    if (sentInitialRequest.current === requestKey) return;
    sentInitialRequest.current = requestKey;
    void send(initialMessage, initialDisplayMessage);
  }, [initialDisplayMessage, initialMessage, send]);

  const runtimeState = useMemo<WorkspaceRuntimeState>(() => {
    const latest = turns[turns.length - 1];
    const resourceCount = turns.reduce((total, turn) => total + turn.cards.size, 0);
    const pathCount = turns.reduce((total, turn) => total + (turn.path ? 1 : 0), 0);
    const status: TutorRuntimeStatus = !latest
      ? "idle"
      : latest.status === "error"
        ? "failed"
        : streaming
          ? latest.steps.length > 0
            ? "running"
            : "thinking"
          : "success";
    return { status, streaming, turnCount: turns.length, resourceCount, pathCount };
  }, [streaming, turns]);

  useEffect(() => {
    onStateChange?.(runtimeState);
  }, [onStateChange, runtimeState]);

  const actionContext: WorkspaceActionContext = {
    disabled: streaming,
    onSelect: send,
  };
  const renderedEmptyState =
    typeof emptyState === "function" ? emptyState(actionContext) : emptyState;

  return (
    <section
      className={cn(
        embedded
          ? "ws-dashboard-card flex min-h-[520px] flex-col gap-3 p-4"
          : "ws-dashboard-card mx-auto flex min-h-[calc(100dvh-4rem)] max-w-4xl flex-col gap-4 p-4 sm:p-6",
        className,
      )}
      id={embedded ? "tutor-conversation" : undefined}
      aria-label="AI 导师对话工作区"
    >
      <header className="flex items-center justify-between gap-4 border-b border-[#898989]/15 pb-3">
        {embedded ? (
          <div>
            <p className="ws-eyebrow">当前对话</p>
            <h2 className="mt-1 text-lg font-medium text-[#303030]">AI 学习导师</h2>
          </div>
        ) : (
          <div>
            <p className="text-lg font-medium text-[#303030]">ReflexLearn</p>
            <p className="mt-1 text-sm text-[#747474]">{user.user_id} 的学习对话</p>
          </div>
        )}
        <div className="flex items-center gap-2">
          {turns.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                resetSession();
                onReset?.();
              }}
              className="inline-flex h-8 items-center justify-center rounded-full border border-[#898989]/18 bg-white/60 px-3 text-xs text-[#303030] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/30"
            >
              新会话
            </button>
          ) : null}
          {!embedded ? (
            <button
              type="button"
              onClick={onLogout}
              className="inline-flex h-9 items-center justify-center rounded-full px-3 text-xs text-[#747474] transition hover:bg-white/55 hover:text-[#303030]"
            >
              退出
            </button>
          ) : null}
        </div>
      </header>

      {showTools ? (
        <details className="rounded-2xl border border-[#898989]/15 bg-white/42">
          <summary className="cursor-pointer select-none px-4 py-3 text-sm text-[#303030]">
            资料与视频工具
          </summary>
          <div className="space-y-4 border-t border-[#898989]/15 p-4">
            <KnowledgeUpload token={token} />
            <VideoJobCard token={token} />
          </div>
        </details>
      ) : null}

      {actionBar ? (
        <div className="flex-none">{actionBar(actionContext)}</div>
      ) : null}

      <StickToBottom
        className="ws-chat-scroll relative min-h-0 flex-1 overflow-y-auto pr-1"
        resize="smooth"
        initial="smooth"
      >
        <StickToBottom.Content className="min-h-full space-y-5 pb-2">
          {turns.length === 0 ? (
            renderedEmptyState ?? (
              <div className="flex min-h-56 items-center justify-center px-6 text-center text-sm leading-6 text-[#747474]">
                输入一个学习目标开始，例如「线性回归」或「机器学习从入门到精通的系统学习路径」。
              </div>
            )
          ) : (
            turns.map((turn) => {
              const cards = Array.from(turn.cards.entries());
              const isStreaming = turn.status === "streaming";
              return (
                <section key={turn.id} className="space-y-3.5">
                  <div className="flex justify-end">
                    <div className="max-w-[78%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-[#303030] px-3 py-2 text-[13px] leading-5 text-white shadow-[0_2px_10px_rgb(48_48_48/0.1)]">
                      {turn.userMessage}
                    </div>
                  </div>

                  {turn.error ? (
                    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
                      出错了：{turn.error}
                    </div>
                  ) : null}

                  <AgentTimeline
                    steps={turn.steps}
                    streaming={isStreaming}
                    durationMs={turn.durationMs}
                  />
                  {turn.assistantMessage ? (
                    <div className="max-w-[680px] text-[14px] leading-6 text-[#303030]">
                      {/* 学术问答会带代码块、公式与列表，必须走 markdown 渲染；
                          此前这里是纯文本 div，只够显示短问候。 */}
                      <MarkdownView content={turn.assistantMessage} />
                    </div>
                  ) : null}
                  <DebatePanel rounds={turn.debateRounds} verdict={turn.verdict} />
                  {turn.path ? <LearningPathCard path={turn.path} /> : null}

                  {cards.length > 0 ? (
                    <div className="space-y-2.5">
                      <p className="text-[11px] text-[#898989]">本轮生成 · {cards.length} 项</p>
                      {cards.map(([cardKey, card]) => (
                        <ResourceCard key={cardKey} card={card} />
                      ))}
                    </div>
                  ) : null}
                </section>
              );
            })
          )}
          {conversationAddon}
        </StickToBottom.Content>
        <ScrollToLatest />
      </StickToBottom>

      <footer className="flex-none border-t border-[#898989]/15 pt-3">
        <ChatInput disabled={streaming} onSend={send} onStop={stop} />
      </footer>
    </section>
  );
}

function ScrollToLatest() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  if (isAtBottom) return null;

  return (
    <button
      type="button"
      onClick={() => void scrollToBottom()}
      className="absolute bottom-2 left-1/2 inline-flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-[#898989]/20 bg-white text-[#303030] shadow-[0_4px_14px_rgb(48_48_48/0.12)] transition hover:-translate-y-0.5"
      aria-label="滚动到最新消息"
      title="滚动到最新消息"
    >
      <ArrowDown size={14} aria-hidden />
    </button>
  );
}
