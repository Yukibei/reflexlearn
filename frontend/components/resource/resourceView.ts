import {
  BookOpenText,
  ClipboardCheck,
  Code2,
  FileText,
  MessagesSquare,
  Network,
  PlaySquare,
  UploadCloud,
  type LucideIcon,
} from "lucide-react";

export type ResourceView = {
  label: string;
  action: string;
  icon: LucideIcon;
  tone: string;
};

const RESOURCE_VIEW: Record<string, ResourceView> = {
  external_video: {
    label: "外部视频",
    action: "观看",
    icon: PlaySquare,
    tone: "rounded-xl bg-[#303030] text-white",
  },
  official_doc: {
    label: "官方资料",
    action: "打开来源",
    icon: BookOpenText,
    tone: "rounded-xl bg-[#303030]/[0.07] text-[#303030]",
  },
  oer: {
    label: "开放课程",
    action: "打开课程",
    icon: BookOpenText,
    tone: "rounded-xl bg-[#e3e5e6] text-[#303030]",
  },
  ai_document: {
    label: "AI 讲解文档",
    action: "阅读",
    icon: FileText,
    tone: "rounded-xl bg-white/75 text-[#303030]",
  },
  quiz: {
    label: "针对练习",
    action: "开始练习",
    icon: ClipboardCheck,
    tone: "rounded-xl bg-[#ffd85f] text-[#303030]",
  },
  user_upload: {
    label: "个人资料",
    action: "查看资料",
    icon: UploadCloud,
    tone: "rounded-xl bg-[#e3e5e6] text-[#303030]",
  },
  code: { label: "代码案例", action: "查看", icon: Code2, tone: "rounded-xl bg-[#303030] text-white" },
  reading: { label: "阅读材料", action: "阅读", icon: BookOpenText, tone: "rounded-xl bg-[#e3e5e6] text-[#303030]" },
  doc: { label: "讲解文档", action: "阅读", icon: FileText, tone: "rounded-xl bg-white/75 text-[#303030]" },
  video: { label: "视频资源", action: "观看", icon: PlaySquare, tone: "rounded-xl bg-[#303030] text-white" },
  mindmap: { label: "思维导图", action: "查看", icon: Network, tone: "rounded-xl bg-[#303030]/[0.07] text-[#303030]" },
  debate: { label: "观点辨析", action: "查看", icon: MessagesSquare, tone: "rounded-xl bg-[#ffd85f] text-[#303030]" },
};

export function viewForResource(type: string): ResourceView {
  return (
    RESOURCE_VIEW[type] ?? {
      label: "学习资源",
      action: "查看",
      icon: FileText,
      tone: "rounded-xl bg-white/70 text-[#747474]",
    }
  );
}

export function isExternalHref(href: string): boolean {
  return href.startsWith("http://") || href.startsWith("https://");
}
