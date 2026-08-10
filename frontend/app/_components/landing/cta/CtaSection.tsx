"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { CtaDashboardMock } from "./CtaDashboardMock";
import { FadeUp, PrimaryButton } from "./primitives";
import { useIsMobile } from "./useIsMobile";
import styles from "./CtaSection.module.css";

export function CtaSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"],
  });
  const dashboardTargetY = useTransform(
    scrollYProgress,
    [0, 1],
    isMobile ? [16, -16] : [56, -56],
  );
  const dashboardY = useSpring(dashboardTargetY, {
    stiffness: 80,
    damping: 24,
    mass: 0.55,
  });

  const startLearning = () => {
    window.location.assign("/chat");
  };

  return (
    <section
      ref={sectionRef}
      id="cta"
      className={`${styles.section} relative isolate min-h-[760px] w-full overflow-hidden`}
    >
      <div className="relative z-20 mx-auto max-w-[1440px] px-4 pb-24 pt-24 sm:px-6 sm:pb-28 sm:pt-32 lg:px-10 lg:pb-32 lg:pt-40 xl:px-14">
        <div className="grid grid-cols-1 items-start gap-16 lg:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.45fr)] lg:gap-10 xl:gap-16">
          <div className="max-w-[400px] lg:pt-14">
            <FadeUp>
              <h2 className="text-3xl font-normal leading-[1.05] tracking-normal text-foreground sm:text-4xl">
                从一个目标，走到一条真正会更新的学习路径。
              </h2>
            </FadeUp>
            <FadeUp delay={0.12}>
              <p className="mt-6 max-w-[380px] text-base leading-[1.5] text-landing-text sm:text-lg">
                ReflexLearn 会先理解你的基础、薄弱点和时间安排，再让多个智能体共同规划路径、生成资源，并用每次学习后的反馈持续调整下一步。
              </p>
            </FadeUp>
            <FadeUp delay={0.24} className="mt-10">
              <PrimaryButton as="button" onClick={startLearning}>免费开始</PrimaryButton>
            </FadeUp>
          </div>

          <motion.div
            style={{ y: prefersReducedMotion ? 0 : dashboardY }}
            className={`${styles.motionLayer} relative z-20 w-full min-w-0`}
          >
            <CtaDashboardMock />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
