#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
export API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"
API_BASE="http://127.0.0.1:${API_PORT}"

{
  log_header "check_observe"
  "$(python_cmd)" - "$API_BASE" <<'PY'
import sys

import httpx

base = sys.argv[1]
metrics_url = f"{base}/metrics"

with httpx.Client(timeout=10) as client:
    resp = client.get(metrics_url)
    resp.raise_for_status()
    text = resp.text

required = [
    "reflexlearn_http_requests_total",
    "reflexlearn_http_request_duration_seconds",
    "reflexlearn_agent_node_duration_seconds",
    "reflexlearn_llm_requests_total",
    "reflexlearn_degradations_total",
]
missing = [name for name in required if name not in text]
if missing:
    raise RuntimeError(f"metrics endpoint missing: {missing}")
print(f"[OK] metrics endpoint {metrics_url}")
PY
} 2>&1 | tee -a "$LOG_DIR/check_observe.log"
