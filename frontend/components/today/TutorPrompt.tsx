import Link from "next/link";
import { ArrowUpRight, MessageSquareText, Sparkles } from "lucide-react";

type TutorPromptProps = {
  prompt: {
    message: string;
    actionLabel: string;
    href: string;
  };
};

export function TutorPrompt({ prompt }: TutorPromptProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-[#303030] p-5 text-white shadow-[0_2px_20px_rgb(0_0_0/0.10)]">
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-[#ffd85f]">
            <Sparkles size={16} aria-hidden />
            <span className="text-xs font-medium tracking-[0.16em]">AI TUTOR</span>
          </div>
          <Link
            href={prompt.href}
            aria-label="打开 AI 导师"
            title="打开 AI 导师"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            <ArrowUpRight size={15} aria-hidden />
          </Link>
        </div>
        <p className="mt-5 text-pretty text-xl font-medium leading-8">{prompt.message}</p>
        <Link
          href={prompt.href}
          className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-medium text-[#303030] transition-transform hover:scale-[1.02] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd85f]"
        >
          <MessageSquareText size={15} aria-hidden />
          {prompt.actionLabel}
        </Link>
      </div>
    </section>
  );
}
