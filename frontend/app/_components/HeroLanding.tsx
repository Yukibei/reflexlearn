"use client";

import Link from "next/link";
import { HeroHeader } from "./landing/HeroHeader";
import { CtaSection } from "./landing/cta/CtaSection";
import { LandingShowcase } from "./landing/cta/LandingShowcase";

export default function HeroLanding() {
  return (
    <div className="relative min-h-screen bg-background" style={{ fontFamily: "var(--font-body)" }}>
      <video
        className="fixed inset-0 z-0 h-full w-full object-cover"
        src="/hero-loop.mp4"
        autoPlay
        loop
        muted
        playsInline
      />

      <HeroHeader />

      <section className="absolute inset-0 z-10 flex h-[100svh] flex-col justify-center px-6 pb-16 pt-28 text-center text-foreground sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center">
          <div className="max-w-5xl">
            <h1
              className="animate-fade-rise text-5xl font-normal leading-[1.18] sm:text-6xl md:text-7xl"
              style={{ fontFamily: "var(--font-display)" }}
            >
              让每一次学习，
              <br />
              都被<em className="not-italic text-glass-cyan">记住</em>、被
              <em className="not-italic text-glass-cyan">进化</em>。
            </h1>

            <p className="animate-fade-rise-delay mx-auto mt-8 max-w-2xl text-base leading-relaxed text-foreground/75 sm:text-lg">
              ReflexLearn 是一套会自我反思的学习系统。六个智能体协作规划路径，
              生成文档、导图、代码、题目、阅读与视频，让每一次对话沉淀为更懂你的经验。
            </p>

            <div className="animate-fade-rise-delay-2 mt-12 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/chat"
                className="liquid-glass cursor-pointer rounded-full px-12 py-4.5 text-base text-foreground transition-transform hover:scale-[1.03]"
              >
                开始学习之旅
              </Link>
              <a
                href="#cta"
                className="rounded-full px-6 py-4.5 text-sm text-foreground/65 transition-colors hover:text-foreground"
              >
                了解学习系统 ↓
              </a>
            </div>
          </div>
        </div>
      </section>

      <div aria-hidden="true" className="pointer-events-none h-[100svh]" />
      <div className="relative z-20">
        <CtaSection />
        <LandingShowcase />
      </div>
    </div>
  );
}
