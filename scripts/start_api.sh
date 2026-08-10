#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults

export REFLEXLEARN_LOG_FILE="$LOG_DIR/api.log"
API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "start_api :$API_PORT"
  "$(python_cmd)" -m uvicorn reflexlearn.main:app --host 127.0.0.1 --port "$API_PORT"
} 2>&1 | tee -a "$LOG_DIR/start_api.log"
