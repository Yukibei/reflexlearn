#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "stop_api :$API_PORT"
  if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "\
      \$port = [int]'$API_PORT'; \
      \$processIds = Get-NetTCPConnection -LocalPort \$port -State Listen -ErrorAction SilentlyContinue | \
        Select-Object -ExpandProperty OwningProcess -Unique; \
      if (-not \$processIds) { Write-Output \"No listener on :\$port\" } \
      else { foreach (\$processId in \$processIds) { Write-Output \"Stopping PID \$processId on :\$port\"; Stop-Process -Id \$processId -Force -ErrorAction SilentlyContinue } }; \
      \$uvicornIds = Get-CimInstance Win32_Process | \
        Where-Object { \$_.Name -like 'python*' -and \$_.CommandLine -like '*uvicorn reflexlearn.main:app*' } | \
        Select-Object -ExpandProperty ProcessId -Unique; \
      foreach (\$processId in \$uvicornIds) { Write-Output \"Stopping uvicorn PID \$processId\"; Stop-Process -Id \$processId -Force -ErrorAction SilentlyContinue }; \
      \$forkIds = Get-CimInstance Win32_Process | \
        Where-Object { \$_.Name -like 'python*' -and \$_.CommandLine -like '*--multiprocessing-fork*' } | \
        Select-Object -ExpandProperty ProcessId -Unique; \
      foreach (\$processId in \$forkIds) { Write-Output \"Stopping uvicorn fork PID \$processId\"; Stop-Process -Id \$processId -Force -ErrorAction SilentlyContinue }"
  else
    echo "stop_api.sh requires powershell.exe on Windows."
    exit 1
  fi
} 2>&1 | tee -a "$LOG_DIR/stop_api.log"
