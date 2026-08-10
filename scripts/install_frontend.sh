#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_local_network

{
  log_header "install_frontend"
  cd "$PROJECT_ROOT/frontend"
  if command -v cmd.exe >/dev/null 2>&1; then
    MSYS_NO_PATHCONV=1 MSYS2_ARG_CONV_EXCL='*' cmd.exe /C "npm install"
  else
    npm install
  fi
} 2>&1 | tee -a "$LOG_DIR/install_frontend.log"
