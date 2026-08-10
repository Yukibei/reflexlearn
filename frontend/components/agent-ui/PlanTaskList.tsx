"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import styles from "./PlanTaskList.module.css";

export interface PlanTaskItem {
  id: string;
  label: string;
  meta: string;
}

interface PlanTaskListProps {
  items: PlanTaskItem[];
  title?: string;
  activeIndex?: number;
}

const classes = (base: string, enabled?: boolean) =>
  `${base}${enabled ? ` ${styles.on}` : ""}`;

function RollDigit({ char }: { char: string }) {
  const previous = useRef(char);
  const [roll, setRoll] = useState<{ from: string; to: string } | null>(null);
  const [up, setUp] = useState(false);

  useEffect(() => {
    if (char === previous.current) return;
    const from = previous.current;
    previous.current = char;
    setRoll({ from, to: char });
    setUp(false);
    const frame = requestAnimationFrame(() =>
      requestAnimationFrame(() => setUp(true)),
    );
    const timer = window.setTimeout(() => setRoll(null), 380);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [char]);

  if (!roll) return <span className={styles.rollDigit}>{char}</span>;
  return (
    <span className={styles.rollDigit}>
      <span className={classes(styles.rollInner, up)}>
        <span>{roll.from}</span>
        <span>{roll.to}</span>
      </span>
    </span>
  );
}

function StatusIcon({ active }: { active: boolean }) {
  return active ? (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        d="m12.75 15 3-3m0 0-3-3m3 3h-7.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeDasharray="1.8 3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function PlanTaskList({
  items,
  title = "学习计划",
  activeIndex = 0,
}: PlanTaskListProps) {
  const [collapsed, setCollapsed] = useState(false);
  const completed = Math.max(0, Math.min(activeIndex, items.length));

  return (
    <div className={styles.todo}>
      <button
        type="button"
        className={styles.todoHead}
        aria-expanded={!collapsed}
        aria-label={collapsed ? "展开学习计划" : "收起学习计划"}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className={styles.todoHeadIcon}>
          <svg className={styles.todoListIcon} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.01M3.75 12h.01m-.01 5.25h.01"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
          </svg>
          <svg className={styles.todoChevron} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="m19.5 8.25-7.5 7.5-7.5-7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <span className={styles.todoTitle}>{title}</span>
        <span className={styles.todoCount} aria-label={`${completed}/${items.length}`}>
          <RollDigit char={String(completed)} />/{items.length}
        </span>
      </button>

      <div className={`${styles.todoCollapsible} ${collapsed ? styles.isCollapsed : ""}`}>
        <div className={styles.todoInner}>
          <ul className={styles.todoList}>
            {items.map((item, index) => {
              const active = index === activeIndex;
              return (
                <li
                  key={item.id}
                  className={`${styles.todoItem} ${active ? styles.active : ""}`}
                  style={{ "--item-index": index } as CSSProperties}
                >
                  <span className={styles.todoIconWrap}>
                    <StatusIcon active={active} />
                  </span>
                  <span className={styles.todoLabel} data-label={item.label}>
                    {item.label}
                  </span>
                  <span className={styles.todoMeta}>{item.meta}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
