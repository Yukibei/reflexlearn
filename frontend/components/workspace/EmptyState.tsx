import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  framed?: boolean;
}

export function EmptyState({ icon: Icon, title, description, action, framed = true }: EmptyStateProps) {
  return (
    <div className={`${framed ? "ws-card" : ""} flex min-h-56 flex-col items-center justify-center px-6 py-12 text-center`}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#303030] text-white">
        <Icon size={20} aria-hidden />
      </span>
      <h3 className="mt-4 text-lg font-medium text-[#303030]">{title}</h3>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-[#747474]">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
