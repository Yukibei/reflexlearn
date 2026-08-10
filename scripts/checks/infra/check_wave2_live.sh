#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults

{
  log_header "check_wave2_live"
  python_file "$SCRIPTS_ROOT/checks/infra/check_wave2_live.py"
} 2>&1 | tee -a "$LOG_DIR/check_wave2_live.log"
