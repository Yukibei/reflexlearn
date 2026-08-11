#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

VERSION="${1:-}"
DEPLOY_MODE="${2:-build}"
COMPOSE_FILE="$PROJECT_ROOT/deploy/compose.production.yml"
ENV_FILE="$PROJECT_ROOT/.env"
API_IMAGE="reflexlearn-api:local"
ROLLBACK_TAG="reflexlearn-rollback/api:$VERSION"

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || {
  echo "版本只能包含字母、数字、点、下划线和连字符，且不超过 80 个字符" >&2
  exit 1
}
[[ "${CONFIRM_REFLEXLEARN_API_VERSION:-}" == "$VERSION" ]] || {
  echo "请设置 CONFIRM_REFLEXLEARN_API_VERSION=$VERSION 后重试" >&2
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

current_container="$(compose ps -q api)"
[[ -n "$current_container" ]] || { echo "生产 API 容器不存在" >&2; exit 1; }
current_image="$("$(docker_cmd)" inspect --format '{{.Image}}' "$current_container")"
"$(docker_cmd)" tag "$current_image" "$ROLLBACK_TAG"

recover_failed_deployment() {
  local status=$?
  trap - ERR
  echo "API 部署失败，恢复镜像：$ROLLBACK_TAG" >&2
  "$(docker_cmd)" tag "$ROLLBACK_TAG" "$API_IMAGE"
  compose up -d --no-build --no-deps --force-recreate api
  "$SCRIPTS_ROOT/check_production.sh" || true
  exit "$status"
}
trap recover_failed_deployment ERR

{
  log_header "deploy_api_production $VERSION"
  compose config --quiet
  if [[ "$DEPLOY_MODE" == --use-loaded-image ]]; then
    "$(docker_cmd)" image inspect "$API_IMAGE" >/dev/null
  else
    compose build api
  fi
  compose up -d --no-build --no-deps --force-recreate api
  "$SCRIPTS_ROOT/check_production.sh"
  mkdir -p "$PROJECT_ROOT/runtime"
  printf '%s\n' "$VERSION" > "$PROJECT_ROOT/runtime/current-api-release.tmp"
  mv "$PROJECT_ROOT/runtime/current-api-release.tmp" \
    "$PROJECT_ROOT/runtime/current-api-release"
} 2>&1 | tee -a "$LOG_DIR/deploy_api_production.log"

trap - ERR
printf 'ReflexLearn API 部署完成：%s；回滚镜像：%s\n' "$VERSION" "$ROLLBACK_TAG"

# init 服务与 api 共用 reflexlearn-api:local，本脚本刻意不触发它：
# init 执行 scripts/init/init_production.sh（建表与初始化数据），属于有副作用的一次性任务，
# 不应随每次 API 发布自动重跑。若本次改动含 schema 变更，发布后单独执行：
#   docker compose --env-file .env -f deploy/compose.production.yml run --rm init
printf '提示：如本次改动涉及数据库 schema 变更，需另行执行 init 服务。\n'
