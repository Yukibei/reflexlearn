#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_local_network
FRONTEND_PORT="${1:-${FRONTEND_PORT:-$(env_port FRONTEND_PORT 23002)}}"
# 默认相对路径 /api：浏览器同源请求，由 next.config rewrites 代理到后端，
# HttpOnly 会话 cookie 才能在刷新后随请求发送（127.0.0.1/localhost 跨站会丢 cookie）。
FRONTEND_API_BASE="${2:-${NEXT_PUBLIC_API_BASE:-/api}}"
BACKEND_ORIGIN="${3:-${BACKEND_ORIGIN:-http://127.0.0.1:$(env_port API_PORT 28000)}}"
export NEXT_PUBLIC_API_BASE="$FRONTEND_API_BASE"
export BACKEND_ORIGIN

{
  log_header "start_frontend :$FRONTEND_PORT -> $NEXT_PUBLIC_API_BASE (proxy -> $BACKEND_ORIGIN)"
  cd "$PROJECT_ROOT/frontend"
  if command -v cmd.exe >/dev/null 2>&1; then
    # Git Bash(MSYS) 会把 /C 和 /api 当 POSIX 路径转换成 D:/Program Files/Git/...，
    # 两个豁免变量关闭转换；WSL 下它们是普通环境变量、无副作用。
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' cmd.exe /C "set NEXT_PUBLIC_API_BASE=$FRONTEND_API_BASE&& set BACKEND_ORIGIN=$BACKEND_ORIGIN&& npm run dev -- --hostname 127.0.0.1 --port $FRONTEND_PORT"
  else
    npm run dev -- --hostname 127.0.0.1 --port "$FRONTEND_PORT"
  fi
} 2>&1 | tee -a "$LOG_DIR/start_frontend.log"
