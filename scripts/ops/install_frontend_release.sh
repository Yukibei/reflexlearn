#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_ARCHIVE="${1:?缺少远端归档路径}"
VERSION="${2:?缺少版本}"
EXPECTED_SHA="${3:?缺少归档 SHA-256}"
SELF_PATH="${4:?缺少安装器路径}"
REMOTE_RUNTIME_ARCHIVE="${5:?缺少远端运行时归档路径}"
EXPECTED_RUNTIME_SHA="${6:?缺少运行时归档 SHA-256}"
PROJECT_ROOT=/data/apps/reflexlearn
STAGE_DIR="$PROJECT_ROOT/runtime/stages/$VERSION"
RELEASE_ARCHIVE="$PROJECT_ROOT/runtime/releases/reflexlearn-frontend-$VERSION.tar.gz"
RELEASE_RUNTIME_ARCHIVE="$PROJECT_ROOT/runtime/releases/reflexlearn-web-runtime-$VERSION.tar.gz"
BACKUP_DIR="/data/backups/reflexlearn/pre-frontend-$VERSION-$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE_INSTALLED=false

restore_source() {
  local status=$?
  trap - EXIT
  if (( status != 0 )) && [[ "$SOURCE_INSTALLED" == true ]]; then
    rm -rf -- "$PROJECT_ROOT/frontend"
    mv "$BACKUP_DIR/frontend" "$PROJECT_ROOT/frontend"
    while IFS=$'\t' read -r target backup; do
      rm -f -- "$target"
      [[ ! -f "$backup" ]] || mv "$backup" "$target"
    done < "$BACKUP_DIR/files.tsv"
  fi
  rm -rf -- "$STAGE_DIR"
  rm -f -- "$SELF_PATH"
  if (( status != 0 )); then
    rm -f -- "$REMOTE_ARCHIVE" "$REMOTE_RUNTIME_ARCHIVE"
    docker image rm "reflexlearn-web:$VERSION" >/dev/null 2>&1 || true
  fi
  exit "$status"
}
trap restore_source EXIT

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || exit 1
actual_sha="$(sha256sum "$REMOTE_ARCHIVE" | awk '{print $1}')"
[[ "$actual_sha" == "$EXPECTED_SHA" ]] || {
  echo "归档 SHA-256 不一致" >&2
  exit 1
}
actual_runtime_sha="$(sha256sum "$REMOTE_RUNTIME_ARCHIVE" | awk '{print $1}')"
[[ "$actual_runtime_sha" == "$EXPECTED_RUNTIME_SHA" ]] || {
  echo "运行时归档 SHA-256 不一致" >&2
  exit 1
}
if tar -tzf "$REMOTE_ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env($|\.))'; then
  echo "归档包含非法路径或环境文件" >&2
  exit 1
fi

mkdir -p "$STAGE_DIR" "$BACKUP_DIR" \
  "$PROJECT_ROOT/runtime/releases"
tar -xzf "$REMOTE_ARCHIVE" -C "$STAGE_DIR"
for required in \
  .dockerignore \
  frontend/package.json \
  deploy/Dockerfile.frontend \
  deploy/Dockerfile.frontend.runtime \
  deploy/compose.production.yml \
  scripts/check_production.sh \
  scripts/deploy_frontend_production.sh \
  scripts/ops/check_production.sh \
  scripts/ops/deploy_frontend_production.sh; do
  test -f "$STAGE_DIR/$required"
done
find "$STAGE_DIR/scripts" -type f -name '*.sh' -exec bash -n {} +
mkdir -p "$STAGE_DIR/runtime-image"
tar -xzf "$REMOTE_RUNTIME_ARCHIVE" -C "$STAGE_DIR/runtime-image"
docker build --pull=false \
  --file "$STAGE_DIR/runtime-image/Dockerfile.frontend.runtime" \
  --tag "reflexlearn-web:$VERSION" \
  --tag reflexlearn-web:latest \
  "$STAGE_DIR/runtime-image"

mv "$PROJECT_ROOT/frontend" "$BACKUP_DIR/frontend"
SOURCE_INSTALLED=true
touch "$BACKUP_DIR/files.tsv"
for relative in \
  .dockerignore \
  deploy/Dockerfile.frontend \
  deploy/Dockerfile.frontend.runtime \
  deploy/compose.production.yml \
  scripts/_lib.sh \
  scripts/check_production.sh \
  scripts/deploy_frontend_production.sh \
  scripts/ops/check_production.sh \
  scripts/ops/deploy_frontend_production.sh; do
  target="$PROJECT_ROOT/$relative"
  backup="$BACKUP_DIR/${relative//\//__}"
  [[ ! -f "$target" ]] || cp -a "$target" "$backup"
  printf '%s\t%s\n' "$target" "$backup" >> "$BACKUP_DIR/files.tsv"
  install -D -m 0755 "$STAGE_DIR/$relative" "$target"
done
chmod 0644 "$PROJECT_ROOT/deploy/Dockerfile.frontend" \
  "$PROJECT_ROOT/deploy/Dockerfile.frontend.runtime" \
  "$PROJECT_ROOT/deploy/compose.production.yml" \
  "$PROJECT_ROOT/.dockerignore"
mv "$STAGE_DIR/frontend" "$PROJECT_ROOT/frontend"

CONFIRM_REFLEXLEARN_FRONTEND_VERSION="$VERSION" \
  bash "$PROJECT_ROOT/scripts/deploy_frontend_production.sh" \
    "$VERSION" --use-loaded-image

mv "$REMOTE_ARCHIVE" "$RELEASE_ARCHIVE"
mv "$REMOTE_RUNTIME_ARCHIVE" "$RELEASE_RUNTIME_ARCHIVE"
printf 'ReflexLearn 前端发布完成：%s\n备份：%s\n源码归档：%s\n源码 SHA-256：%s\n运行时归档：%s\n运行时 SHA-256：%s\n' \
  "$VERSION" "$BACKUP_DIR" "$RELEASE_ARCHIVE" "$EXPECTED_SHA" \
  "$RELEASE_RUNTIME_ARCHIVE" "$EXPECTED_RUNTIME_SHA"
