"use client";

import type { MouseEventHandler, ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FadeUpProps = {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
};

export function FadeUp({ children, className, delay = 0, y = 24 }: FadeUpProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

type MaterialIconName = "auto_awesome" | "arrow_outward" | "arrow_upward";

type MIconProps = {
  name: MaterialIconName;
  size?: number;
  fill?: 0 | 1;
  weight?: number;
  grade?: number;
  opticalSize?: number;
  className?: string;
};

export function MIcon({
  name,
  size = 20,
  fill = 0,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  className,
}: MIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn("material-symbols-outlined shrink-0 leading-none", className)}
      style={{
        width: size,
        height: size,
        fontFamily: '"Material Symbols Outlined"',
        fontSize: size,
        fontFeatureSettings: '"liga"',
        WebkitFontFeatureSettings: '"liga"',
        fontVariationSettings: `'FILL' ${fill}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
      }}
    >
      {name}
    </span>
  );
}

function AnimatedText({ children }: { children: string }) {
  return (
    <span className="relative block overflow-hidden">
      <span className="block transition-transform duration-[240ms] ease-out group-hover:-translate-y-full">
        {children}
      </span>
      <span
        aria-hidden="true"
        className="absolute left-0 top-full block transition-transform duration-[240ms] ease-out group-hover:-translate-y-full"
      >
        {children}
      </span>
    </span>
  );
}

type PrimaryButtonProps = {
  as?: "a" | "button";
  children: string;
  className?: string;
  href?: string;
  size?: "sm" | "md" | "lg";
  type?: "button" | "submit" | "reset";
  onClick?: MouseEventHandler<HTMLButtonElement>;
};

const buttonSizes = {
  sm: "h-9 px-5 text-xs",
  md: "h-10 px-7 text-sm",
  lg: "h-12 px-9 text-sm font-medium",
};

export function PrimaryButton({
  as = "a",
  children,
  className,
  href = "/chat",
  size = "lg",
  type = "button",
  onClick,
}: PrimaryButtonProps) {
  const classes = cn(
    "group inline-flex items-center justify-center rounded-full bg-white/80 text-black leading-none transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#14191E] active:scale-[0.98]",
    buttonSizes[size],
    className,
  );

  if (as === "button") {
    return (
      <button type={type} className={classes} onClick={onClick}>
        <AnimatedText>{children}</AnimatedText>
      </button>
    );
  }

  return (
    <a href={href} className={classes}>
      <AnimatedText>{children}</AnimatedText>
    </a>
  );
}
