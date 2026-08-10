#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults

{
  log_header "init_all"
  python_file "$SCRIPTS_ROOT/init/init_db.py"
  python_file "$SCRIPTS_ROOT/init/init_qdrant.py"
  python_file "$SCRIPTS_ROOT/jobs/data/ingest_graph.py"
} 2>&1 | tee -a "$LOG_DIR/init_all.log"
