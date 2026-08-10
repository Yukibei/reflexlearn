#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
COMPOSE_FILE="$PROJECT_ROOT/deploy/compose.production.yml"
ENV_FILE="$PROJECT_ROOT/.env"

test -f "$ENV_FILE" || { echo ".env 不存在，无法检查生产环境" >&2; exit 1; }

compose() {
  "$(docker_cmd)" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

wait_for_url() {
  local url="$1"
  local label="$2"
  local attempt

  for attempt in $(seq 1 60); do
    if curl --fail --silent --show-error --max-time 10 \
      --output /dev/null "$url" 2>/dev/null; then
      printf '%s 已就绪。\n' "$label"
      return 0
    fi
    sleep 2
  done
  echo "$label 未在 120 秒内就绪" >&2
  return 1
}

{
  log_header "check_production"
  compose config --quiet
  running_services="$(compose ps --services --filter status=running)"
  for service in postgres redis qdrant api web; do
    grep -qx "$service" <<<"$running_services" || {
      echo "服务未运行：$service" >&2
      exit 1
    }
  done
  wait_for_url http://127.0.0.1:18000/api/health "FastAPI"
  wait_for_url http://127.0.0.1:13000/ "Next.js"
  wait_for_url https://learn.liyilin.xyz/ "公网 HTTPS"
  compose ps
} 2>&1 | tee -a "$LOG_DIR/check_production.log"
