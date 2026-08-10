"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/workspace";
import { getTutorAction } from "@/components/chat/TutorActionBar";
import {
  TutorStudio,
  type InitialTutorRequest,
} from "@/components/chat/TutorStudio";
import { useAuthSession } from "@/lib/authContext";

function getInitialTutorRequest(
  actionId: string | null,
  topic: string | null,
): InitialTutorRequest | null {
  if (actionId === "explain") {
    const subject = topic?.trim() || "当前学习内容";
    return {
      displayMessage: `解释：${subject}`,
      message:
        `你是一对一 AI 学习导师。请结合我的学习画像，用直观例子、关键公式和一道自测题解释“${subject}”，并指出常见误区。`,
    };
  }
  if (actionId === "practice" && topic?.trim()) {
    const subject = topic.trim();
    return {
      displayMessage: `练习：${subject}`,
      message: `请围绕“${subject}”生成一组由浅入深的练习。结合我的学习画像控制难度，先给题目和作答要求，等我回答后再逐题反馈并归纳薄弱点。`,
    };
  }
  const action = getTutorAction(actionId);
  return action ? { message: action.prompt, displayMessage: action.label } : null;
}

function ChatPageContent() {
  const { auth, onLogout } = useAuthSession();
  const searchParams = useSearchParams();
  const initialRequest = getInitialTutorRequest(
    searchParams.get("action"),
    searchParams.get("topic"),
  );

  return (
    <section className="ws-page">
      <PageHeader
        eyebrow="NIUNIU AI TUTOR"
        title="牛牛 AI 学习导师"
        description="读取你的目标、学习画像和今日进度，在同一场对话中完成诊断、讲解、规划、练习与资源生成。"
      />
      <TutorStudio
        token={auth.access_token}
        user={auth.user}
        onLogout={onLogout}
        initialRequest={initialRequest}
      />
    </section>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="ws-dashboard-card h-72 animate-pulse" />}>
      <ChatPageContent />
    </Suspense>
  );
}
