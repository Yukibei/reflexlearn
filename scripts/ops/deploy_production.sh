#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
COMPOSE_FILE="deploy/compose.production.yml"

{
  log_header "deploy_production"
  test -f .env || { echo ".env 不存在，拒绝生产部署" >&2; exit 1; }
  "$(docker_cmd)" compose -f "$COMPOSE_FILE" up -d --build
  "$(docker_cmd)" compose -f "$COMPOSE_FILE" ps
} 2>&1 | tee -a "$LOG_DIR/deploy_production.log"
