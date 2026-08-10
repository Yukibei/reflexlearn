import Link from "next/link";
import { FadeUp, MIcon, PrimaryButton } from "./primitives";

type ShowcaseItem = {
  eyebrow: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  href: string;
  linkLabel: string;
  imagePosition: string;
};

const SYSTEM_SIGNALS = [
  ["6", "协作智能体"],
  ["3", "检索召回通道"],
  ["6", "学习资源形态"],
  ["持续", "反思记忆更新"],
] as const;

const SHOWCASES: readonly ShowcaseItem[] = [
  {
    eyebrow: "01 · Learning path",
    title: "路径不是章节清单，而是一份会持续改写的行程单。",
    description:
      "系统把目标拆成当前节点、下一步行动、关联资源和复习提醒。画像、错题或资源完成状态发生变化时，后续顺序也会随之调整。",
    image: "/landing/learning-path.png",
    alt: "ReflexLearn 学习路径页面，展示当前节点、下一步行动与关联资源",
    href: "/plan",
    linkLabel: "查看学习路径",
    imagePosition: "object-top",
  },
  {
    eyebrow: "02 · Learning context",
    title: "视频、文档和练习，都发生在同一个学习现场。",
    description:
      "资源不再是孤立链接。每份内容都知道它服务哪个目标、处于路径哪个节点，并允许你标记学习中、已完成或待复盘。",
    image: "/landing/resource-video.png",
    alt: "ReflexLearn 资源详情页面中的课程视频与学习状态控制",
    href: "/resources",
    linkLabel: "进入资源库",
    imagePosition: "object-center",
  },
  {
    eyebrow: "03 · Feedback loop",
    title: "系统不仅记录完成了什么，也解释为什么你正在进步。",
    description:
      "路径推进、知识点掌握度、薄弱项变化和智能体协作证据汇入同一份成长档案。下一轮计划有据可依，而不是重新猜测。",
    image: "/landing/growth-ledger.png",
    alt: "ReflexLearn 成长档案页面，展示趋势、薄弱点变化和学习证据",
    href: "/growth",
    linkLabel: "查看成长档案",
    imagePosition: "object-top",
  },
];

export function LandingShowcase() {
  return (
    <section className="relative overflow-hidden bg-[#10171c] text-white">
      <div className="border-y border-white/10">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 px-6 sm:grid-cols-4 lg:px-10 xl:px-14">
          {SYSTEM_SIGNALS.map(([value, label]) => (
            <div key={label} className="border-b border-white/10 py-8 sm:border-b-0 sm:border-r sm:px-6 last:border-r-0">
              <p className="text-3xl font-medium tabular-nums text-white sm:text-4xl">{value}</p>
              <p className="mt-2 text-xs text-white/45 sm:text-sm">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1440px] px-6 lg:px-10 xl:px-14">
        {SHOWCASES.map((item, index) => (
          <article
            key={item.eyebrow}
            className={`grid items-center gap-12 border-b border-white/10 py-20 sm:py-24 lg:gap-16 lg:py-28 ${
              index % 2 === 1
                ? "lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.72fr)]"
                : "lg:grid-cols-[minmax(280px,0.72fr)_minmax(0,1.35fr)]"
            }`}
          >
            <FadeUp className={index % 2 === 1 ? "lg:order-2" : undefined}>
              <div className="max-w-[430px]">
                <p className="text-xs font-medium text-cyan-200/75">{item.eyebrow}</p>
                <h2 className="mt-5 text-4xl font-normal leading-[1.08] tracking-normal text-white sm:text-5xl" style={{ fontFamily: "var(--font-display)" }}>
                  {item.title}
                </h2>
                <p className="mt-7 text-base leading-8 text-white/62 sm:text-lg">{item.description}</p>
                <Link href={item.href} className="mt-9 inline-flex items-center gap-2 border-b border-white/30 pb-1 text-sm font-medium text-white transition-colors hover:border-white hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70">
                  {item.linkLabel}
                  <MIcon name="arrow_outward" size={16} />
                </Link>
              </div>
            </FadeUp>

            <FadeUp delay={0.12} className={index % 2 === 1 ? "lg:order-1" : undefined}>
              <figure className="liquid-glass overflow-hidden rounded-lg p-2 shadow-[0_28px_90px_rgba(0,16,24,0.32)] sm:p-3">
                <div className="aspect-[16/10] overflow-hidden rounded-md bg-[#f4f2ed]">
                  <img
                    src={item.image}
                    alt={item.alt}
                    loading="lazy"
                    decoding="async"
                    className={`h-full w-full object-cover ${item.imagePosition}`}
                  />
                </div>
              </figure>
            </FadeUp>
          </article>
        ))}
      </div>

      <div className="px-6 py-28 sm:py-36 lg:px-10 xl:px-14">
        <FadeUp className="mx-auto flex max-w-[1080px] flex-col items-start justify-between gap-10 border-t border-white/12 pt-14 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <p className="text-xs font-medium text-cyan-200/75">Start with one goal</p>
            <h2 className="mt-5 text-4xl font-normal leading-[1.08] tracking-normal sm:text-6xl" style={{ fontFamily: "var(--font-display)" }}>
              下一步，不再靠猜。
            </h2>
            <p className="mt-6 max-w-xl text-base leading-8 text-white/60 sm:text-lg">
              告诉智能体你想学什么、现在会什么。第一条路径会从这次对话开始生成。
            </p>
          </div>
          <PrimaryButton href="/chat">开始规划</PrimaryButton>
        </FadeUp>
      </div>
    </section>
  );
}
