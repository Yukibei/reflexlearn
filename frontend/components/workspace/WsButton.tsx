import type { ButtonHTMLAttributes } from "react";

const VARIANTS = {
  primary:
    "bg-[#ffd85f] text-[#303030] shadow-[0_2px_12px_rgb(48_48_48/0.1)] hover:bg-[#ffe38b]",
  outline:
    "border border-[#898989]/20 bg-white/60 text-[#303030] shadow-[inset_0_1px_0_rgb(255_255_255/0.72)] hover:bg-white/90",
  ghost: "text-[#747474] hover:bg-white/55 hover:text-[#303030]",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
} as const;

type WsButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof VARIANTS;
  size?: keyof typeof SIZES;
};

export function WsButton({
  variant = "outline",
  size = "md",
  className,
  type = "button",
  children,
  ...props
}: WsButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-1.5 rounded-full font-medium transition duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35 disabled:cursor-not-allowed disabled:opacity-50 ${VARIANTS[variant]} ${SIZES[size]} ${className ?? ""}`}
      {...props}
    >
      {children}
    </button>
  );
}
