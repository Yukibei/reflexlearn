import type { LucideIcon } from "lucide-react";

import { viewForResource } from "@/components/resource/resourceView";

export interface ResourceMeta {
  label: string;
  icon: LucideIcon;
  chipClass: string;
}

export function resourceMeta(type: string): ResourceMeta {
  const view = viewForResource(type);
  return { label: view.label, icon: view.icon, chipClass: view.tone };
}
