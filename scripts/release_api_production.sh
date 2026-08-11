#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/_lib.sh"

VERSION="${1:-}"
SSH_TARGET="${2:-}"
ARCHIVE="$PROJECT_ROOT/output/releases/reflexlearn-api-$VERSION.tar.gz"
INSTALLER="$PROJECT_ROOT/scripts/ops/install_api_release.sh"
REMOTE_ARCHIVE="/tmp/reflexlearn-api-$VERSION.tar.gz"
REMOTE_INSTALLER="/tmp/install-reflexlearn-api-$VERSION.sh"

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
  log_header "release_api_production $VERSION"
  bash "$SCRIPT_DIR/package_api_production.sh" "$VERSION"
  archive_sha="$(sha256sum "$ARCHIVE" | awk '{print $1}')"
  scp "${ssh_args[@]}" "$ARCHIVE" "$SSH_TARGET:$REMOTE_ARCHIVE"
  scp "${ssh_args[@]}" "$INSTALLER" "$SSH_TARGET:$REMOTE_INSTALLER"
  ssh "${ssh_args[@]}" "$SSH_TARGET" \
    bash "$REMOTE_INSTALLER" \
      "$REMOTE_ARCHIVE" "$VERSION" "$archive_sha" "$REMOTE_INSTALLER"
} 2>&1 | tee -a "$LOG_DIR/release_api_production.log"
