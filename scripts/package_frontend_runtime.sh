#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VERSION="${1:-}"
OUTPUT_DIR="$PROJECT_ROOT/output/releases"
ARCHIVE="$OUTPUT_DIR/reflexlearn-web-runtime-$VERSION.tar.gz"
STAGE_DIR="$(mktemp -d)"

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || {
  echo "用法: $0 <版本>" >&2
  exit 1
}
trap 'rm -rf "$STAGE_DIR"' EXIT

for required in \
  frontend/.next/standalone \
  frontend/.next/static \
  frontend/public \
  deploy/Dockerfile.frontend.runtime; do
  test -e "$PROJECT_ROOT/$required" || {
    echo "缺少生产构建产物：$required" >&2
    exit 1
  }
done

mkdir -p "$OUTPUT_DIR" "$STAGE_DIR/frontend/.next"
cp -a "$PROJECT_ROOT/frontend/public" "$STAGE_DIR/frontend/public"
cp -a "$PROJECT_ROOT/frontend/.next/standalone" \
  "$STAGE_DIR/frontend/.next/standalone"
cp -a "$PROJECT_ROOT/frontend/.next/static" \
  "$STAGE_DIR/frontend/.next/static"
cp "$PROJECT_ROOT/deploy/Dockerfile.frontend.runtime" "$STAGE_DIR/"

tar -czf "$ARCHIVE" -C "$STAGE_DIR" .
if tar -tzf "$ARCHIVE" | grep -Eq '(^|/)\.env($|\.)|\.(pem|key|p12|jks)$'; then
  echo "运行时归档包含敏感文件" >&2
  exit 1
fi
sha256sum "$ARCHIVE"
