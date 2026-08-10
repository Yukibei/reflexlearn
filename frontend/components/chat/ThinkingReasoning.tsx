"use client";

import { useEffect, useRef, useState } from "react";

import styles from "./ThinkingReasoning.module.css";

const SENTENCE_HEIGHT = 34;
const SENTENCE_GAP = 3;
const MAX_VIEWPORT_HEIGHT = 136;
const FADE_HEIGHT = 12;

interface ThinkingReasoningProps {
  items: string[];
  active: boolean;
  durationMs: number | null;
}

export function ThinkingReasoning({
  items,
  active,
  durationMs,
}: ThinkingReasoningProps) {
  const [open, setOpen] = useState(false);
  const [liveDurationMs, setLiveDurationMs] = useState(0);
  const [fade, setFade] = useState({ top: false, bottom: true });
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    setLiveDurationMs(0);
    const interval = window.setInterval(() => {
      setLiveDurationMs(Date.now() - startedAt);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [active]);

  useEffect(() => {
    if (active) setOpen(false);
  }, [active]);

  const done = !active;
  const expanded = active || open;
  const contentHeight =
    items.length > 0
      ? items.length * SENTENCE_HEIGHT + (items.length - 1) * SENTENCE_GAP
      : 0;
  const capped = contentHeight > MAX_VIEWPORT_HEIGHT;
  const viewportHeight = capped ? MAX_VIEWPORT_HEIGHT : contentHeight;
  const scrollable = done && open;
  const translateY = scrollable
    ? 0
    : capped
      ? MAX_VIEWPORT_HEIGHT - FADE_HEIGHT - contentHeight
      : 0;
  const showTop = scrollable ? fade.top : capped;
  const showBottom = scrollable ? fade.bottom : capped;
  const mask = capped
    ? `linear-gradient(to bottom, transparent 0, #000 ${showTop ? FADE_HEIGHT : 0}px, #000 calc(100% - ${showBottom ? FADE_HEIGHT : 0}px), transparent 100%)`
    : "none";
  const elapsedSeconds = Math.max(
    1,
    Math.round((durationMs ?? liveDurationMs) / 1000),
  );

  const handleScroll = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    setFade({
      top: viewport.scrollTop > 1,
      bottom:
        viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - 1,
    });
  };

  const toggle = () => {
    const next = !open;
    if (next) {
      setFade({ top: false, bottom: true });
      if (viewportRef.current) viewportRef.current.scrollTop = 0;
    }
    setOpen(next);
  };

  return (
    <div className={styles.tr}>
      <button
        type="button"
        className={`${styles.trHeader} ${done ? styles.isClickable : ""}`}
        aria-expanded={expanded}
        aria-label={done ? "展开或收起智能体处理过程" : "智能体正在处理"}
        onClick={done ? toggle : undefined}
      >
        {done ? (
          <span className={styles.trLabel}>
            <span className={styles.trVerb}>思考</span>了 {elapsedSeconds} 秒
          </span>
        ) : (
          <span className={`${styles.trLabel} ${styles.trShimmer}`}>
            正在思考…
          </span>
        )}
        {done ? (
          <svg
            className={styles.trChevron}
            viewBox="0 0 24 24"
            width="12"
            height="12"
            aria-hidden="true"
          >
            <path
              d="m4.5 15.75 7.5-7.5 7.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </button>

      <div
        className={`${styles.trCollapsible} ${expanded ? "" : styles.isCollapsed}`}
      >
        <div className={styles.trInner}>
          <div
            ref={viewportRef}
            className={`${styles.trViewport} ${scrollable ? styles.isScroll : ""}`}
            style={{
              height: `${viewportHeight}px`,
              WebkitMaskImage: mask,
              maskImage: mask,
            }}
            onScroll={scrollable ? handleScroll : undefined}
          >
            <div
              className={styles.trStream}
              style={{ transform: `translateY(${translateY}px)` }}
            >
              {items.map((item, index) => (
                <p key={`${index}-${item}`} className={styles.trSentence}>
                  {item}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
