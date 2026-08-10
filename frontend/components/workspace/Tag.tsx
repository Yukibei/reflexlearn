import type { HTMLAttributes } from "react";

const TONES = {
  neutral: "border-[#898989]/18 bg-white/52 text-[#747474]",
  navy: "border-[#303030]/12 bg-[#303030]/[0.07] text-[#303030]",
  accent: "border-[#ffd85f] bg-[#ffd85f] text-[#303030]",
  success: "border-[#303030]/12 bg-[#303030] text-white",
  warning: "border-[#ffd85f]/70 bg-[#fff1b8] text-[#746016]",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

export type TagTone = keyof typeof TONES;

type TagProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: TagTone;
};

export function Tag({ tone = "neutral", className, children, ...props }: TagProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${TONES[tone]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </span>
  );
}
