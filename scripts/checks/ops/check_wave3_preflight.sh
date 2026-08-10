#!/usr/bin/env bash
# 波次 3 preflight：冻结代码门禁基线（单测/前端构建/脚本语法），
# 后端可达时附加 W2 API 与 LoRA 导出 smoke；后端不可达则标注 SKIP，
# 不把环境缺失误判成代码回归。
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

PASS=0
FAIL=0
declare -a SUMMARY

record() {
  local status="$1" name="$2"
  SUMMARY+=("$status  $name")
  case "$status" in
    PASS) PASS=$((PASS + 1)) ;;
    FAIL) FAIL=$((FAIL + 1)) ;;
  esac
}

run_gate() {
  local name="$1"
  shift
  log_header "wave3-preflight: $name"
  if "$@"; then
    record PASS "$name"
  else
    record FAIL "$name"
  fi
}

check_syntax() {
  local f rc=0
  while IFS= read -r -d '' f; do
    if ! bash -n "$f"; then
      echo "[syntax-fail] $f"
      rc=1
    fi
  done < <(find "$SCRIPTS_ROOT" -name "*.sh" -print0)
  return "$rc"
}

api_reachable() {
  local code
  code="$(curl -s --noproxy '*' -o /dev/null -w '%{http_code}' \
    "http://127.0.0.1:${API_PORT}/api/health" 2>/dev/null || true)"
  [[ "$code" == "200" ]]
}

{
  log_header "check_wave3_preflight port=$API_PORT"

  run_gate "unit-tests" bash "$SCRIPTS_ROOT/test_unit.sh"
  run_gate "frontend-build" bash "$SCRIPTS_ROOT/build_frontend.sh"
  run_gate "script-syntax" check_syntax

  if api_reachable; then
    run_gate "wave2-api-smoke" bash "$SCRIPTS_ROOT/check_wave2_api.sh" "$API_PORT"
    run_gate "lora-export-smoke" bash "$SCRIPTS_ROOT/check_lora_export.sh" "$API_PORT"
  else
    record SKIP "wave2-api-smoke (api :$API_PORT unreachable; start with scripts/start_api.sh)"
    record SKIP "lora-export-smoke (api :$API_PORT unreachable; start with scripts/start_api.sh)"
  fi

  echo ""
  echo "==== wave3 preflight summary ===="
  for line in "${SUMMARY[@]}"; do
    echo "  $line"
  done
  echo "  PASS=$PASS FAIL=$FAIL"
  if [[ "$FAIL" -gt 0 ]]; then
    echo "[FAIL] wave3 preflight failed: $FAIL gate(s) red"
    exit 1
  fi
  echo "[OK] wave3 preflight passed (code gates green)"
} 2>&1 | tee -a "$LOG_DIR/check_wave3_preflight.log"

exit "${PIPESTATUS[0]}"
