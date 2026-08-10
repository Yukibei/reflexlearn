#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_python_defaults

{
  log_header "prepare_lora_dataset"
  python_file "$SCRIPTS_ROOT/jobs/training/prepare_lora_dataset.py" "$@"
} 2>&1 | tee -a "$LOG_DIR/prepare_lora_dataset.log"
