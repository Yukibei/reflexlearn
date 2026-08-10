#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"
mkdir -p "$LOG_DIR"

TODAY_PAGE="$PROJECT_ROOT/frontend/app/(app)/today/page.tsx"
TODAY_API="$PROJECT_ROOT/frontend/lib/todayApi.ts"
TODAY_FALLBACK="$PROJECT_ROOT/frontend/lib/todayFallback.ts"
TODAY_TYPES="$PROJECT_ROOT/frontend/lib/todayTypes.ts"
NAV_FILE="$PROJECT_ROOT/frontend/lib/nav.ts"
AUTH_GATE="$PROJECT_ROOT/frontend/app/_components/AuthGate.tsx"
SIDE_NAV="$PROJECT_ROOT/frontend/components/workspace/SideNav.tsx"

fail() {
  echo "check_today_page: $1" >&2
  exit 1
}

require_file() {
  [[ -f "$1" ]] || fail "缺少文件：$1"
}

require_text() {
  local file="$1"
  local text="$2"
  grep -Fq "$text" "$file" || fail "未找到必需内容：$text"
}

forbid_text() {
  local file="$1"
  local text="$2"
  if grep -Fq "$text" "$file"; then
    fail "出现禁用文案：$text"
  fi
}

{
  echo "check_today_page -> static acceptance"
  require_file "$TODAY_PAGE"
  require_file "$TODAY_API"
  require_file "$TODAY_FALLBACK"
  require_file "$TODAY_TYPES"
  require_file "$NAV_FILE"
  require_file "$AUTH_GATE"
  require_file "$SIDE_NAV"

  require_text "$TODAY_API" "/today"
  require_text "$TODAY_API" "mapTodaySummary"
  require_text "$TODAY_PAGE" "getTodaySummary"
  require_text "$TODAY_PAGE" "当前显示离线学习建议，稍后会自动恢复同步。"
  require_text "$TODAY_PAGE" "today.mainTask.spaceId"
  require_text "$TODAY_TYPES" "interface TodaySummary"
  require_text "$TODAY_TYPES" "interface TodayTask"
  require_text "$TODAY_TYPES" "interface TodayResource"
  require_text "$TODAY_TYPES" "interface TodayReviewItem"
  require_text "$TODAY_FALLBACK" "开始今日学习"
  require_text "$TODAY_PAGE" "让 AI 导师解释"
  require_text "$TODAY_PAGE" "调整学习顺序"
  require_text "$TODAY_FALLBACK" "B 站视频"
  require_text "$TODAY_FALLBACK" "AI 讲解文档"
  require_text "$TODAY_FALLBACK" "针对练习"
  require_text "$TODAY_FALLBACK" "官方资料"
  require_text "$TODAY_PAGE" "和 AI 导师聊聊"
  require_text "$TODAY_FALLBACK" "上传课程资料"
  require_text "$TODAY_FALLBACK" "录入一道错题"
  require_text "$TODAY_FALLBACK" "生成一组练习"
  require_text "$TODAY_FALLBACK" "创建学习目标"

  require_text "$NAV_FILE" "href: \"/today\""
  require_text "$AUTH_GATE" "router.replace(\"/today\")"
  require_text "$SIDE_NAV" 'aria-label="工作台导航"'
  require_text "$SIDE_NAV" 'aria-label={open ? "收起导航" : "展开导航"}'

  for word in demo mock "local draft" "coming soon" "will be connected later" "工作台"; do
    forbid_text "$TODAY_PAGE" "$word"
    forbid_text "$TODAY_API" "$word"
    forbid_text "$TODAY_FALLBACK" "$word"
    forbid_text "$SIDE_NAV" "$word"
  done

  echo "check_today_page -> ok"
} 2>&1 | tee -a "$LOG_DIR/check_today_page.log"
