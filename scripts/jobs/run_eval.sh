#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
export REFLEXLEARN_LOG_FILE="${REFLEXLEARN_LOG_FILE:-$LOG_DIR/run_eval_python.log}"

{
  log_header "run_eval"
  if [[ ! -f "$SCRIPTS_ROOT/jobs/run_eval.py" ]]; then
    echo "scripts/jobs/run_eval.py is not implemented yet."
    exit 2
  fi
  python_file "$SCRIPTS_ROOT/jobs/run_eval.py" "$@"
} 2>&1 | tee -a "$LOG_DIR/run_eval.log"
