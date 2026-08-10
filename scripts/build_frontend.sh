#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_local_network
# 默认相对路径 /api（同源代理，见 next.config rewrites）；BACKEND_ORIGIN 决定代理目标。
FRONTEND_API_BASE="${1:-${NEXT_PUBLIC_API_BASE:-/api}}"
BACKEND_ORIGIN="${2:-${BACKEND_ORIGIN:-http://127.0.0.1:$(env_port API_PORT 28000)}}"
export NEXT_PUBLIC_API_BASE="$FRONTEND_API_BASE"
export BACKEND_ORIGIN

{
  log_header "build_frontend -> $NEXT_PUBLIC_API_BASE (proxy -> $BACKEND_ORIGIN)"
  cd "$PROJECT_ROOT/frontend"
  if command -v cmd.exe >/dev/null 2>&1; then
    # Git Bash(MSYS) 会把 /C 和 /api 当 POSIX 路径转换成 D:/Program Files/Git/...，
    # 两个豁免变量关闭转换；WSL 下它们是普通环境变量、无副作用。
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' cmd.exe /C "set NEXT_PUBLIC_API_BASE=$FRONTEND_API_BASE&& set BACKEND_ORIGIN=$BACKEND_ORIGIN&& npm run build"
  else
    npm run build
  fi
} 2>&1 | tee -a "$LOG_DIR/build_frontend.log"
