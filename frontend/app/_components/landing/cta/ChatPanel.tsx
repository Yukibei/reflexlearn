"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { FadeUp, MIcon } from "./primitives";

type MessageRole = "assistant" | "user";

type ChatMessage = {
  id: number;
  role: MessageRole;
  content: string;
};

type ChatPanelProps = {
  initialScroll?: "top" | "bottom";
  animateMessagesIn?: boolean;
};

const INITIAL_MESSAGES: ChatMessage[] = [
  {
    id: 1,
    role: "assistant",
    content:
      "先告诉我你的目标、当前基础和每天能投入的时间。我会先诊断，再给出一条可以真正推进的学习路径。",
  },
  {
    id: 2,
    role: "user",
    content: "我想在 60 天内系统掌握机器学习，并完成一个能展示的项目。",
  },
  {
    id: 3,
    role: "assistant",
    content:
      "路径已拆成四个阶段：数学补齐、核心算法、代码实践和项目复盘。每个节点都会关联文档、视频、练习与验收任务。",
  },
];

const ASSISTANT_REPLY =
  "我会把这个问题写入当前学习空间，并结合画像、错题和路径进度调整下一步。";

export function ChatPanel({
  initialScroll = "bottom",
  animateMessagesIn = false,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(INITIAL_MESSAGES);
  const [draft, setDraft] = useState("");
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const nextMessageId = useRef(INITIAL_MESSAGES.length + 1);

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;
    scrollArea.scrollTop = initialScroll === "bottom" ? scrollArea.scrollHeight : 0;
  }, [initialScroll]);

  const sendMessage = () => {
    const content = draft.trim();
    if (!content) return;

    const userId = nextMessageId.current++;
    const assistantId = nextMessageId.current++;
    setMessages((current) => [
      ...current,
      { id: userId, role: "user", content },
      { id: assistantId, role: "assistant", content: ASSISTANT_REPLY },
    ]);
    setDraft("");

    if (textareaRef.current) textareaRef.current.style.height = "auto";
    requestAnimationFrame(() => {
      const scrollArea = scrollAreaRef.current;
      if (scrollArea) scrollArea.scrollTop = scrollArea.scrollHeight;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const resizeTextarea = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 88)}px`;
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-[rgba(8,8,10,0.6)] backdrop-blur-[24px]">
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-3">
        <span className="grid size-7 place-items-center rounded-full bg-white/5">
          <MIcon name="auto_awesome" size={14} />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white">ReflexLearn 学习教练</span>
          <span className="block truncate text-[11px] text-white/40">画像、路径与资源持续联动</span>
        </span>
      </header>

      <div ref={scrollAreaRef} className="scrollbar-hide min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-5">
        {messages.map((message, index) => {
          const bubble = (
            <div className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <p
                className={
                  message.role === "user"
                    ? "max-w-[85%] rounded-2xl bg-white/15 px-4 py-2.5 text-sm leading-relaxed text-white/90"
                    : "max-w-[85%] rounded-2xl border border-white/5 bg-white/5 px-4 py-2.5 text-sm leading-relaxed text-white/70"
                }
              >
                {message.content}
              </p>
            </div>
          );

          return animateMessagesIn ? (
            <FadeUp key={message.id} delay={index * 0.12} y={16}>
              {bubble}
            </FadeUp>
          ) : (
            <div key={message.id}>{bubble}</div>
          );
        })}
      </div>

      <div className="shrink-0 p-3 pt-0">
        <div className="liquid-glass flex items-end gap-2 rounded-2xl p-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={draft}
            placeholder="输入你的学习目标..."
            aria-label="输入学习目标"
            onChange={(event) => {
              setDraft(event.target.value);
              resizeTextarea();
            }}
            onKeyDown={handleKeyDown}
            className="max-h-[88px] min-h-8 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-5 text-white outline-none placeholder:text-white/35"
          />
          <button
            type="button"
            aria-label="发送消息"
            onClick={sendMessage}
            className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.97]"
          >
            <MIcon name="arrow_upward" size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
