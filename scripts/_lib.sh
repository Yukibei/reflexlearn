#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$PROJECT_ROOT/logs"

ensure_logs() {
  mkdir -p "$LOG_DIR"
}

cd_root() {
  cd "$PROJECT_ROOT"
}

log_header() {
  local name="$1"
  printf '\n[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$name"
}

use_local_network() {
  local local_hosts="127.0.0.1,localhost,::1"
  export NO_PROXY="${NO_PROXY:+$NO_PROXY,}$local_hosts"
  export no_proxy="${no_proxy:+$no_proxy,}$local_hosts"
}

use_python_defaults() {
  export PYTHONPATH="${PYTHONPATH:-src}"
  export PYTHONUTF8=1
  export PYTHONIOENCODING=utf-8
  export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-1}"
  export TRANSFORMERS_OFFLINE="${TRANSFORMERS_OFFLINE:-1}"
  export HF_DATASETS_OFFLINE="${HF_DATASETS_OFFLINE:-1}"
  export HF_ENDPOINT="${HF_ENDPOINT:-https://hf-mirror.com}"
  export OPENBLAS_NUM_THREADS="${OPENBLAS_NUM_THREADS:-1}"
  export OMP_NUM_THREADS="${OMP_NUM_THREADS:-1}"
  export MKL_NUM_THREADS="${MKL_NUM_THREADS:-1}"
}

uv_cmd() {
  if command -v uv >/dev/null 2>&1; then
    command -v uv
    return
  fi
  if command -v uv.exe >/dev/null 2>&1; then
    command -v uv.exe
    return
  fi

  local candidates=(
    "/mnt/e/uv-i686-pc-windows-msvc/uv.exe"
    "/c/Users/ASUS/.local/bin/uv.exe"
    "$HOME/.local/bin/uv.exe"
  )
  for path in "${candidates[@]}"; do
    if [[ -x "$path" ]]; then
      printf '%s\n' "$path"
      return
    fi
  done

  if command -v where.exe >/dev/null 2>&1; then
    local win_path
    win_path="$(where.exe uv 2>/dev/null | tr -d '\r' | head -n 1 || true)"
    if [[ -n "$win_path" ]]; then
      if command -v cygpath >/dev/null 2>&1; then
        cygpath -u "$win_path"
      else
        printf '%s\n' "$win_path"
      fi
      return
    fi
  fi

  echo "uv executable not found" >&2
  return 127
}

python_cmd() {
  local candidates=(
    "$PROJECT_ROOT/.venv/Scripts/python.exe"
    "$PROJECT_ROOT/.venv/bin/python"
  )
  for path in "${candidates[@]}"; do
    if [[ -x "$path" ]]; then
      printf '%s\n' "$path"
      return
    fi
  done

  echo ".venv python executable not found; create it with uv first" >&2
  return 127
}

native_path() {
  local path="$1"

  if [[ "$path" == /* ]] && command -v wslpath >/dev/null 2>&1; then
    wslpath -w "$path"
    return
  fi
  if [[ "$path" == /* ]] && command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$path"
    return
  fi

  printf '%s\n' "$path"
}

python_file() {
  local script_path="$1"
  shift
  "$(python_cmd)" "$(native_path "$script_path")" "$@"
}

docker_cmd() {
  if command -v docker.exe >/dev/null 2>&1; then
    command -v docker.exe
    return
  fi
  local candidates=(
    "/mnt/c/Program Files/Docker/Docker/resources/bin/docker.exe"
  )
  for path in "${candidates[@]}"; do
    if [[ -x "$path" ]]; then
      printf '%s\n' "$path"
      return
    fi
  done
  if command -v docker >/dev/null 2>&1; then
    command -v docker
    return
  fi

  echo "docker executable not found; start Docker Desktop or enable WSL integration" >&2
  return 127
}
