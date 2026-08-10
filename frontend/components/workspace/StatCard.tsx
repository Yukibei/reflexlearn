import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: LucideIcon;
}

export function StatCard({ label, value, hint, icon: Icon }: StatCardProps) {
  return (
    <div className="ws-dashboard-card p-4">
      <div className="flex items-center gap-1.5 text-xs text-[#747474]">
        {Icon ? <Icon size={14} className="text-[#747474]" aria-hidden /> : null}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-medium tabular-nums text-[#303030]">{value}</div>
      {hint ? <p className="mt-1 text-xs text-[#747474]">{hint}</p> : null}
    </div>
  );
}
