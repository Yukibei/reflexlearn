#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VERSION="${1:-}"
SSH_TARGET="${2:-}"
SOURCE_ARCHIVE="$PROJECT_ROOT/output/releases/reflexlearn-frontend-$VERSION.tar.gz"
RUNTIME_ARCHIVE="$PROJECT_ROOT/output/releases/reflexlearn-web-runtime-$VERSION.tar.gz"
INSTALLER="$PROJECT_ROOT/scripts/ops/install_frontend_release.sh"
REMOTE_SOURCE="/tmp/reflexlearn-frontend-$VERSION.tar.gz"
REMOTE_RUNTIME="/tmp/reflexlearn-web-runtime-$VERSION.tar.gz"
REMOTE_INSTALLER="/tmp/install-reflexlearn-frontend-$VERSION.sh"
PRODUCTION_BACKEND_ORIGIN="${REFLEXLEARN_PRODUCTION_BACKEND_ORIGIN:-http://api:8000}"

[[ "$VERSION" =~ ^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$ ]] || {
  echo "用法: $0 <版本> <SSH 用户@主机>" >&2
  exit 1
}
[[ "$SSH_TARGET" =~ ^[A-Za-z0-9._-]+@([A-Za-z0-9.-]+|\[[0-9A-Fa-f:]+\])$ ]] || {
  echo "SSH 目标必须是 用户@主机" >&2
  exit 1
}

ssh_args=()
if [[ -n "${REFLEXLEARN_SSH_IDENTITY:-}" ]]; then
  test -f "$REFLEXLEARN_SSH_IDENTITY" || {
    echo "REFLEXLEARN_SSH_IDENTITY 指向的私钥不存在" >&2
    exit 1
  }
  ssh_args=(-i "$REFLEXLEARN_SSH_IDENTITY")
fi

ensure_logs
cd_root
{
  log_header "release_frontend_production $VERSION"
  BACKEND_ORIGIN="$PRODUCTION_BACKEND_ORIGIN" \
    bash "$SCRIPT_DIR/build_frontend.sh"
  bash "$SCRIPT_DIR/package_frontend_production.sh" "$VERSION"
  bash "$SCRIPT_DIR/package_frontend_runtime.sh" "$VERSION"
  source_sha="$(sha256sum "$SOURCE_ARCHIVE" | awk '{print $1}')"
  runtime_sha="$(sha256sum "$RUNTIME_ARCHIVE" | awk '{print $1}')"
  scp "${ssh_args[@]}" "$SOURCE_ARCHIVE" "$SSH_TARGET:$REMOTE_SOURCE"
  scp "${ssh_args[@]}" "$RUNTIME_ARCHIVE" "$SSH_TARGET:$REMOTE_RUNTIME"
  scp "${ssh_args[@]}" "$INSTALLER" "$SSH_TARGET:$REMOTE_INSTALLER"
  ssh "${ssh_args[@]}" "$SSH_TARGET" \
    bash "$REMOTE_INSTALLER" \
      "$REMOTE_SOURCE" "$VERSION" "$source_sha" "$REMOTE_INSTALLER" \
      "$REMOTE_RUNTIME" "$runtime_sha"
} 2>&1 | tee -a "$LOG_DIR/release_frontend_production.log"
