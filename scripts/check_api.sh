#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
export API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "check_api"
  echo "[INFO] check_api now runs security smoke only. Use scripts/check_api_integrations.sh for Qdrant/PG true-write checks."
  exec "$SCRIPT_DIR/check_api_security.sh" "$API_PORT"
} 2>&1 | tee -a "$LOG_DIR/check_api.log"
