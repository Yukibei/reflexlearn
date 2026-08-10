import type { DebateRound, JudgeVerdict } from "@/lib/types";

export function DebatePanel({
  rounds,
  verdict,
}: {
  rounds: DebateRound[];
  verdict: JudgeVerdict | null;
}) {
  if (rounds.length === 0 && !verdict) return null;

  return (
    <details className="group max-w-[680px] rounded-[10px] bg-white/80 shadow-[0_0_0_1px_rgb(137_137_137/0.16),0_2px_8px_rgb(48_48_48/0.04)]">
      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 text-[13px] text-[#303030] marker:hidden">
        <span className="font-medium">多智能体辩论</span>
        <span className="text-[11px] text-[#898989]">{rounds.length} 轮</span>
        {verdict ? (
          <span className="ml-auto max-w-[55%] truncate text-[11px] text-[#747474]">
            裁决：{verdict.winner_position}
          </span>
        ) : null}
        <span className="text-[#a1a1a1] transition-transform group-open:rotate-180">⌄</span>
      </summary>
      <div className="space-y-2 border-t border-[#898989]/15 px-3 py-3">
        {rounds.map((round) => (
          <div key={round.round} className="text-xs leading-5 text-[#747474]">
            <p className="font-medium text-[#303030]">第 {round.round} 轮</p>
            {round.positions.map((position, index) => (
              <p key={index}>
                {position.perspective || "观点"}：{position.claim}
              </p>
            ))}
          </div>
        ))}
        {verdict ? (
          <div className="border-t border-[#898989]/15 pt-2 text-xs leading-5 text-[#747474]">
            <p>{verdict.reasoning}</p>
            <p className="mt-1 text-[11px] text-[#a1a1a1]">
              置信度 {Math.round((verdict.confidence || 0) * 100)}%
            </p>
          </div>
        ) : null}
      </div>
    </details>
  );
}
