#!/usr/bin/env bash
set -Eeuo pipefail

REMOTE_ARCHIVE="${1:?缺少远端归档路径}"
VERSION="${2:?缺少版本}"
EXPECTED_SHA="${3:?缺少归档 SHA-256}"
SELF_PATH="${4:?缺少安装器路径}"
PROJECT_ROOT=/data/apps/reflexlearn
STAGE_DIR="$PROJECT_ROOT/runtime/stages/$VERSION-api"
RELEASE_ARCHIVE="$PROJECT_ROOT/runtime/releases/reflexlearn-api-$VERSION.tar.gz"
BACKUP_DIR="/data/backups/reflexlearn/pre-api-$VERSION-$(date -u +%Y%m%dT%H%M%SZ)"
SOURCE_INSTALLED=false

restore_source() {
  local status=$?
  trap - EXIT
  if (( status != 0 )) && [[ "$SOURCE_INSTALLED" == true ]]; then
    rm -rf -- "$PROJECT_ROOT/src" "$PROJECT_ROOT/scripts/init"
    mv "$BACKUP_DIR/src" "$PROJECT_ROOT/src"
    mv "$BACKUP_DIR/init" "$PROJECT_ROOT/scripts/init"
    while IFS=$'\t' read -r target backup; do
      rm -f -- "$target"
      [[ ! -f "$backup" ]] || mv "$backup" "$target"
    done < "$BACKUP_DIR/files.tsv"
  fi
  rm -rf -- "$STAGE_DIR"
  rm -f -- "$SELF_PATH"
  if (( status != 0 )); then
    rm -f -- "$REMOTE_ARCHIVE"
  fi
  exit "$status"
}
trap restore_source EXIT

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || exit 1
actual_sha="$(sha256sum "$REMOTE_ARCHIVE" | awk '{print $1}')"
[[ "$actual_sha" == "$EXPECTED_SHA" ]] || {
  echo "API 归档 SHA-256 不一致" >&2
  exit 1
}
if tar -tzf "$REMOTE_ARCHIVE" | grep -Eq '(^/|(^|/)\.\.(/|$)|(^|/)\.env($|\.))'; then
  echo "API 归档包含非法路径或环境文件" >&2
  exit 1
fi

mkdir -p "$STAGE_DIR" "$BACKUP_DIR" "$PROJECT_ROOT/runtime/releases"
tar -xzf "$REMOTE_ARCHIVE" -C "$STAGE_DIR"
for required in \
  pyproject.toml uv.lock README.md .dockerignore \
  src/reflexlearn/main.py scripts/init/init_production.sh \
  deploy/Dockerfile.api deploy/compose.production.yml \
  scripts/_lib.sh scripts/check_production.sh scripts/deploy_api_production.sh \
  scripts/ops/check_production.sh scripts/ops/deploy_api_production.sh \
  scripts/ops/install_api_release.sh; do
  test -f "$STAGE_DIR/$required"
done
find "$STAGE_DIR/scripts" -type f -name '*.sh' -exec bash -n {} +

mv "$PROJECT_ROOT/src" "$BACKUP_DIR/src"
mv "$PROJECT_ROOT/scripts/init" "$BACKUP_DIR/init"
SOURCE_INSTALLED=true
touch "$BACKUP_DIR/files.tsv"
for relative in \
  pyproject.toml uv.lock README.md .dockerignore \
  deploy/Dockerfile.api deploy/compose.production.yml \
  scripts/_lib.sh scripts/check_production.sh scripts/deploy_api_production.sh \
  scripts/ops/check_production.sh scripts/ops/deploy_api_production.sh \
  scripts/ops/install_api_release.sh; do
  target="$PROJECT_ROOT/$relative"
  backup="$BACKUP_DIR/${relative//\//__}"
  [[ ! -f "$target" ]] || cp -a "$target" "$backup"
  printf '%s\t%s\n' "$target" "$backup" >> "$BACKUP_DIR/files.tsv"
  install -D -m 0644 "$STAGE_DIR/$relative" "$target"
done
chmod 0755 \
  "$PROJECT_ROOT/scripts/_lib.sh" \
  "$PROJECT_ROOT/scripts/check_production.sh" \
  "$PROJECT_ROOT/scripts/deploy_api_production.sh" \
  "$PROJECT_ROOT/scripts/ops/check_production.sh" \
  "$PROJECT_ROOT/scripts/ops/deploy_api_production.sh" \
  "$PROJECT_ROOT/scripts/ops/install_api_release.sh"
mv "$STAGE_DIR/src" "$PROJECT_ROOT/src"
mv "$STAGE_DIR/scripts/init" "$PROJECT_ROOT/scripts/init"

CONFIRM_REFLEXLEARN_API_VERSION="$VERSION" \
  bash "$PROJECT_ROOT/scripts/deploy_api_production.sh" "$VERSION"

mv "$REMOTE_ARCHIVE" "$RELEASE_ARCHIVE"
printf 'ReflexLearn API 发布完成：%s\n备份：%s\n源码归档：%s\n源码 SHA-256：%s\n' \
  "$VERSION" "$BACKUP_DIR" "$RELEASE_ARCHIVE" "$EXPECTED_SHA"
