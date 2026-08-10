#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VERSION="${1:-}"
OUTPUT_DIR="$PROJECT_ROOT/output/releases"
ARCHIVE="$OUTPUT_DIR/reflexlearn-frontend-$VERSION.tar.gz"
STAGE_DIR="$(mktemp -d)"

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || {
  echo "用法: $0 <版本>" >&2
  exit 1
}
trap 'rm -rf "$STAGE_DIR"' EXIT

mkdir -p "$OUTPUT_DIR" "$STAGE_DIR/frontend" "$STAGE_DIR/deploy" \
  "$STAGE_DIR/scripts/ops"
tar -C "$PROJECT_ROOT/frontend" \
  --exclude=node_modules --exclude=.next --exclude='.env*' \
  --exclude='*.log' -cf - . | tar -C "$STAGE_DIR/frontend" -xf -

cp "$PROJECT_ROOT/deploy/Dockerfile.frontend" "$STAGE_DIR/deploy/"
cp "$PROJECT_ROOT/deploy/Dockerfile.frontend.runtime" "$STAGE_DIR/deploy/"
cp "$PROJECT_ROOT/deploy/compose.production.yml" "$STAGE_DIR/deploy/"
cp "$PROJECT_ROOT/.dockerignore" "$STAGE_DIR/"
cp "$PROJECT_ROOT/scripts/_lib.sh" \
  "$PROJECT_ROOT/scripts/check_production.sh" \
  "$PROJECT_ROOT/scripts/deploy_frontend_production.sh" \
  "$STAGE_DIR/scripts/"
cp "$PROJECT_ROOT/scripts/ops/check_production.sh" \
  "$PROJECT_ROOT/scripts/ops/deploy_frontend_production.sh" \
  "$PROJECT_ROOT/scripts/ops/install_frontend_release.sh" \
  "$STAGE_DIR/scripts/ops/"

tar -czf "$ARCHIVE" -C "$STAGE_DIR" .
if tar -tzf "$ARCHIVE" | grep -Eq '(^|/)\.env($|\.)|\.(pem|key|p12|jks)$'; then
  echo "发布归档包含敏感文件" >&2
  exit 1
fi
sha256sum "$ARCHIVE"
