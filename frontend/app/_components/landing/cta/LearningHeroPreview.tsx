"use client";

const VIDEO_SRC = "/hero-loop.mp4";

const NAV_ITEMS = ["今日", "空间", "路径", "资源", "成长"];

export function LearningHeroPreview() {
  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl bg-[#002c42]">
      <video
        src={VIDEO_SRC}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 z-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 z-[1] bg-black/25" />

      <nav className="relative z-10 flex items-center justify-between px-3 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4">
        <p className="text-sm font-normal text-white sm:text-base md:text-lg" style={{ fontFamily: "'Instrument Serif', serif" }}>
          ReflexLearn
        </p>

        <div className="hidden items-center gap-3 text-[9px] text-white/60 md:flex lg:gap-5 lg:text-[10px]">
          {NAV_ITEMS.map((item, index) => (
            <span key={item} className={index === 0 ? "text-white" : undefined}>
              {item}
            </span>
          ))}
        </div>

        <span className="liquid-glass rounded-full px-2.5 py-1 text-[9px] text-white sm:px-3 sm:text-[10px]">
          开始今天的学习
        </span>
      </nav>

      <div className="relative z-10 flex flex-col items-center px-3 pb-6 pt-3 text-center sm:px-4 sm:pt-5 md:pt-7">
        <h1
          className="animate-fade-rise max-w-[90%] text-lg font-normal leading-[1.05] tracking-normal text-white sm:text-2xl md:text-3xl lg:text-4xl"
          style={{ fontFamily: "var(--font-display)" }}
        >
          把远目标，变成
          <em className="not-italic text-white/55">今天能完成的一步。</em>
        </h1>
        <p className="animate-fade-rise-delay mt-2 max-w-[82%] text-[9px] leading-relaxed text-white/65 sm:mt-3 sm:max-w-sm sm:text-[11px] md:mt-4 md:max-w-md md:text-xs">
          六个智能体共同理解目标、规划路径、组织资源，并把每次练习后的反馈写回你的学习画像。
        </p>
        <span className="animate-fade-rise-delay-2 liquid-glass mt-3 rounded-full px-4 py-1.5 text-[9px] text-white sm:mt-4 sm:px-5 sm:py-2 sm:text-[10px] md:mt-5 md:px-6 md:py-2.5">
          生成学习路径
        </span>
      </div>
    </div>
  );
}
