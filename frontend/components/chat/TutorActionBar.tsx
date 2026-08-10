"use client";

import {
  BookOpenCheck,
  ClipboardList,
  Library,
  ListChecks,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

export type TutorAction = {
  id: "profile" | "path" | "practice" | "mistake" | "resources";
  label: string;
  prompt: string;
  icon: LucideIcon;
};

export const TUTOR_ACTIONS: TutorAction[] = [
  {
    id: "profile",
    label: "构建学习画像",
    prompt:
      "You are a one-on-one AI learning tutor. Diagnose my learning goal, current level, weak points, and learning preferences with 3 to 5 concise questions before summarizing my learner profile.",
    icon: ClipboardList,
  },
  {
    id: "path",
    label: "生成学习路径",
    prompt:
      "You are a one-on-one AI learning tutor. Create a staged learning path for my goal with objectives, prerequisites, practice methods, and checkpoints for each stage.",
    icon: ListChecks,
  },
  {
    id: "practice",
    label: "生成一组练习",
    prompt:
      "You are a one-on-one AI learning tutor. Generate a short practice set from easy to hard around my weakest concept, then provide self-check criteria.",
    icon: BookOpenCheck,
  },
  {
    id: "mistake",
    label: "复盘一道错题",
    prompt:
      "You are a one-on-one AI learning tutor. Guide me to provide the question, my answer, and the expected answer, then analyze the error cause and propose remedial practice.",
    icon: RotateCcw,
  },
  {
    id: "resources",
    label: "推荐学习资源",
    prompt:
      "You are a one-on-one AI learning tutor. Recommend learning resources based on my goal and weak points, and explain which problem each resource helps solve.",
    icon: Library,
  },
];

export function getTutorAction(id: string | null): TutorAction | null {
  return TUTOR_ACTIONS.find((action) => action.id === id) ?? null;
}

export function TutorActionBar({
  disabled,
  onSelect,
  onAction,
}: {
  disabled: boolean;
  onSelect: (prompt: string, displayMessage?: string) => void;
  onAction?: (action: TutorAction) => void;
}) {
  return (
    <div className="ws-scroll flex gap-2 pb-1">
      {TUTOR_ACTIONS.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.label}
            type="button"
            disabled={disabled}
            onClick={() => {
              onAction?.(action);
              onSelect(action.prompt, action.label);
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-[#898989]/18 bg-white/56 px-3 text-xs text-[#303030] transition hover:-translate-y-px hover:bg-white active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Icon size={14} strokeWidth={1.7} aria-hidden />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
