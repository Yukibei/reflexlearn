#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

VERSION="${1:-}"
DEPLOY_MODE="${2:-build}"
COMPOSE_FILE="$PROJECT_ROOT/deploy/compose.production.yml"
ENV_FILE="$PROJECT_ROOT/.env"
ROLLBACK_TAG="reflexlearn-rollback/web:$VERSION"

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || {
  echo "版本只能包含字母、数字、点、下划线和连字符，且不超过 80 个字符" >&2
  exit 1
}
[[ "${CONFIRM_REFLEXLEARN_FRONTEND_VERSION:-}" == "$VERSION" ]] || {
  echo "请设置 CONFIRM_REFLEXLEARN_FRONTEND_VERSION=$VERSION 后重试" >&2
  exit 1
}
[[ "$DEPLOY_MODE" == build || "$DEPLOY_MODE" == --use-loaded-image ]] || {
  echo "第二个参数只允许为 --use-loaded-image" >&2
  exit 1
}

ensure_logs
cd_root
test -f "$ENV_FILE" || { echo ".env 不存在，拒绝生产部署" >&2; exit 1; }

compose() {
  "$(docker_cmd)" compose --env-file "$ENV_FILE" -f "$COMPOSE_FILE" "$@"
}

current_container="$(compose ps -q web)"
[[ -n "$current_container" ]] || { echo "生产 Web 容器不存在" >&2; exit 1; }
current_image="$("$(docker_cmd)" inspect --format '{{.Image}}' "$current_container")"
"$(docker_cmd)" tag "$current_image" "$ROLLBACK_TAG"

recover_failed_deployment() {
  local status=$?
  trap - ERR
  echo "前端部署失败，恢复镜像：$ROLLBACK_TAG" >&2
  "$(docker_cmd)" tag "$ROLLBACK_TAG" reflexlearn-web:latest
  compose up -d --no-build --no-deps --force-recreate web
  "$SCRIPTS_ROOT/check_production.sh" || true
  exit "$status"
}
trap recover_failed_deployment ERR

{
  log_header "deploy_frontend_production $VERSION"
  compose config --quiet
  if [[ "$DEPLOY_MODE" == --use-loaded-image ]]; then
    "$(docker_cmd)" image inspect reflexlearn-web:latest >/dev/null
  else
    compose build web
  fi
  compose up -d --no-build --no-deps --force-recreate web
  "$SCRIPTS_ROOT/check_production.sh"
  mkdir -p "$PROJECT_ROOT/runtime"
  printf '%s\n' "$VERSION" > "$PROJECT_ROOT/runtime/current-frontend-release.tmp"
  mv "$PROJECT_ROOT/runtime/current-frontend-release.tmp" \
    "$PROJECT_ROOT/runtime/current-frontend-release"
} 2>&1 | tee -a "$LOG_DIR/deploy_frontend_production.log"

trap - ERR
printf 'ReflexLearn 前端部署完成：%s；回滚镜像：%s\n' "$VERSION" "$ROLLBACK_TAG"
