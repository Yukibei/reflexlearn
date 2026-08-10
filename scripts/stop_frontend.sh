#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
FRONTEND_PORT="${1:-${FRONTEND_PORT:-3002}}"

{
  log_header "stop_frontend :$FRONTEND_PORT"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\
      \$port = [int]'$FRONTEND_PORT'; \
      \$processIds = Get-NetTCPConnection -LocalPort \$port -State Listen -ErrorAction SilentlyContinue | \
        Select-Object -ExpandProperty OwningProcess -Unique; \
      if (-not \$processIds) { Write-Output \"No listener on :\$port\" } \
      else { foreach (\$processId in \$processIds) { Write-Output \"Stopping PID \$processId on :\$port\"; Stop-Process -Id \$processId -Force -ErrorAction SilentlyContinue } }"
  else
    echo "stop_frontend.sh requires powershell.exe on Windows."
    exit 1
  fi
} 2>&1 | tee -a "$LOG_DIR/stop_frontend.log"
