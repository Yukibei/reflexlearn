#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root

{
  log_header "stop_production"
  "$(docker_cmd)" compose -f deploy/compose.production.yml down
} 2>&1 | tee -a "$LOG_DIR/stop_production.log"
