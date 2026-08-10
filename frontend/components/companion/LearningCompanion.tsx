"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { apiJson } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import type { TutorReply } from "@/lib/types";
import { CompanionAvatar } from "./CompanionAvatar";
import { CompanionPanel, type CompanionTurn } from "./CompanionPanel";
import {
  COMPANION_STATUS_EVENT,
  STATUS_LABEL,
  STATUS_TO_MOOD,
  TRANSIENT_STATUS,
  buildContextHint,
  describePage,
  type CompanionStatus,
  type CompanionStatusEventDetail,
} from "./companionState";
import { PET_SHEET, type PetMood } from "./sprites";
import { useCompanionRoam } from "./useCompanionRoam";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";
const PET_WIDTH = 80;
const PET_HEIGHT = Math.round((PET_WIDTH * PET_SHEET.frameHeight) / PET_SHEET.frameWidth);
const GREET_MS = 1600;
const DRAG_THRESHOLD_PX = 6;

interface DragOrigin {
  pointerX: number;
  pointerY: number;
  petX: number;
  petY: number;
}

export function LearningCompanion() {
  const { auth } = useAuthSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<CompanionStatus>("idle");
  const [greeting, setGreeting] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [turns, setTurns] = useState<CompanionTurn[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const greetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOrigin = useRef<DragOrigin | null>(null);
  const draggedRef = useRef(false);

  const busy = status === "thinking" || status === "running";
  const page = describePage(pathname);

  /** 切换状态；一次性状态（success/failed）或带 ttl 的状态会自动回 idle。 */
  const applyStatus = (next: CompanionStatus, ttlMs?: number) => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
    setStatus(next);
    const ttl = ttlMs ?? TRANSIENT_STATUS[next];
    if (ttl) statusTimer.current = setTimeout(() => setStatus("idle"), ttl);
  };

  useEffect(() => {
    setMounted(true);
    const onStatusEvent = (event: Event) => {
      const detail = (event as CustomEvent<CompanionStatusEventDetail>).detail;
      if (detail?.status && detail.status in STATUS_LABEL) {
        applyStatus(detail.status, detail.ttlMs);
      }
    };
    window.addEventListener(COMPANION_STATUS_EVENT, onStatusEvent);
    return () => {
      window.removeEventListener(COMPANION_STATUS_EVENT, onStatusEvent);
      if (statusTimer.current) clearTimeout(statusTimer.current);
      if (greetTimer.current) clearTimeout(greetTimer.current);
    };
    // applyStatus 闭包只依赖 setter，无需加入依赖数组。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [turns, open]);

  const roam = useCompanionRoam({
    active: status === "idle" && !greeting && !hovered,
    goHome: open,
    dragging,
    petWidth: PET_WIDTH,
    petHeight: PET_HEIGHT,
  });

  const toggleOpen = () => {
    setOpen((value) => {
      if (!value) {
        setGreeting(true);
        if (greetTimer.current) clearTimeout(greetTimer.current);
        greetTimer.current = setTimeout(() => setGreeting(false), GREET_MS);
      }
      return !value;
    });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      petX: roam.x,
      petY: roam.y,
    };
    draggedRef.current = false;
  };

  const onPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dx = event.clientX - origin.pointerX;
    const dy = event.clientY - origin.pointerY;
    if (!draggedRef.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      draggedRef.current = true;
      setDragging(true);
    }
    if (draggedRef.current) roam.place(origin.petX + dx, origin.petY + dy);
  };

  const onPointerEnd = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOrigin.current = null;
    setDragging(false);
    window.setTimeout(() => {
      draggedRef.current = false;
    }, 0);
  };

  const onCompanionClick = () => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    toggleOpen();
  };

  const ask = async () => {
    const question = input.trim();
    if (!question || busy) return;
    setInput("");
    setTurns((value) => [...value, { role: "user", text: question }]);
    applyStatus("thinking");
    try {
      const reply = await apiJson<TutorReply>(`${API_BASE}/tutor/ask`, auth.access_token, {
        method: "POST",
        body: JSON.stringify({ question, context_hint: buildContextHint(pathname) }),
      });
      const text = reply.blocked
        ? "这个问题被安全策略拦截了，换个学习相关的问法试试。"
        : reply.answer;
      setTurns((value) => [...value, { role: "companion", text, degraded: reply.degraded }]);
      applyStatus(reply.blocked || reply.degraded ? "failed" : "success");
    } catch {
      setTurns((value) => [
        ...value,
        { role: "companion", text: "网络异常，稍后再试一次。", degraded: true },
      ]);
      applyStatus("failed");
    }
  };

  const mood: PetMood = dragging
    ? "happy"
    : greeting
      ? "happy"
      : status === "idle" && roam.walking
        ? "walk"
        : STATUS_TO_MOOD[status];
  const showStatusChip = status !== "idle" && !open;

  if (!mounted || pathname.startsWith("/chat")) return null;

  return (
    <>
      {open ? (
        <CompanionPanel
          pageName={page.name}
          status={status}
          turns={turns}
          busy={busy}
          input={input}
          onInputChange={setInput}
          onAsk={ask}
          onClose={() => setOpen(false)}
          listRef={listRef}
        />
      ) : null}

      <button
        type="button"
        onClick={onCompanionClick}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onPointerEnter={(event) => {
          if (event.pointerType === "mouse") setHovered(true);
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === "mouse") setHovered(false);
        }}
        className={`fixed left-0 top-0 z-50 flex touch-none flex-col items-center focus-visible:outline-none focus-visible:drop-shadow-[0_0_8px_#ffd85f] ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{
          transform: `translate(${roam.x}px, ${roam.y}px)`,
          transition: dragging ? "none" : "transform 32ms linear",
          willChange: "transform",
        }}
        aria-label={open ? "收起 AI 学伴" : "打开 AI 学伴辅导框"}
      >
        {showStatusChip ? (
          <span className="mb-1 rounded-full border border-[var(--ws-line-strong)] bg-[#fdfcf8] px-2.5 py-0.5 text-[11px] text-[var(--ws-ink)] shadow-sm">
            {STATUS_LABEL[status]}
          </span>
        ) : null}
        <CompanionAvatar mood={mood} size={PET_WIDTH} flip={roam.facing === -1} />
      </button>
    </>
  );
}
