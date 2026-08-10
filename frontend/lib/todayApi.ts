import { apiJson } from "@/lib/apiClient";
import type {
  TodayResource,
  TodayResourceView,
  TodayReviewItem,
  TodayReviewItemView,
  TodayProfileSignal,
  TodayQuickActionView,
  TodaySummary,
  TodaySummaryView,
} from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export async function getTodaySummary(token: string): Promise<TodaySummaryView> {
  const summary = await apiJson<TodaySummary>(`${API_BASE}/today`, token);
  return mapTodaySummary(summary);
}

export function mapTodaySummary(summary: TodaySummary): TodaySummaryView {
  return {
    userId: summary.user_id,
    greeting: summary.greeting,
    currentGoal: summary.current_goal,
    progress: summary.progress,
    mainTask: {
      title: summary.main_task.title,
      reason: summary.main_task.reason,
      estimatedMinutes: summary.main_task.estimated_minutes,
      spaceId: summary.main_task.space_id,
      spaceName: summary.main_task.space_name,
      pathNode: summary.main_task.path_node,
      primaryAction: summary.main_task.primary_action,
    },
    pathNodes: summary.path_nodes,
    pathRecommendation: summary.path_recommendation,
    resources: summary.resources.map(mapTodayResource),
    tutorPrompt: summary.tutor_prompt,
    quickActions: summary.quick_actions.map(mapQuickAction),
    profileSignals: summary.profile_signals,
    reviewQueue: summary.review_queue.map(mapTodayReviewItem),
    degraded: summary.degraded,
  };
}

function mapQuickAction(action: TodayProfileSignal, index: number): TodayQuickActionView {
  const iconByHref: Record<string, TodayQuickActionView["icon"]> = {
    "/knowledge": "upload",
    "/mistakes": "mistake",
    "/chat": "practice",
    "/spaces": "goal",
  };
  const descriptionByIcon: Record<TodayQuickActionView["icon"], string> = {
    upload: "补充讲义、截图或学习材料",
    mistake: "记录卡点并安排复盘",
    practice: "围绕当前薄弱点出题",
    goal: "开启一条新的学习主线",
  };
  const hrefByIcon: Record<TodayQuickActionView["icon"], string> = {
    upload: "/knowledge",
    mistake: "/mistakes?create=1",
    practice: "/chat?action=practice",
    goal: "/spaces?create=1",
  };
  const icon = iconByHref[action.value] ?? "goal";
  return {
    id: `${icon}-${index}`,
    label: action.label,
    description: descriptionByIcon[icon],
    href: hrefByIcon[icon],
    icon,
  };
}

function mapTodayResource(resource: TodayResource): TodayResourceView {
  return {
    id: resource.id,
    type: resource.type,
    title: resource.title,
    provider: resource.provider,
    sourceLabel: resource.source_label,
    estimatedMinutes: resource.estimated_minutes,
    reason: resource.reason,
    href: resource.href,
  };
}

function mapTodayReviewItem(item: TodayReviewItem): TodayReviewItemView {
  return {
    topic: item.topic,
    reason: item.reason,
    dueLabel: item.due_label,
  };
}
