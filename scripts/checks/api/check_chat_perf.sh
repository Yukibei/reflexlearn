#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults

# /api/chat 真实 SSE 性能采集：TTFC（首个 resource_card）+ 总时长（done）
# + LLM 调用按 task_type/status 差分 + resource_card 时间分布（区分生成首帧 vs assemble replay）。
# 度量是 PERF 优化的验收前提（docs/19 §3/§5）；分离网关 LLM 与端到端以隔离中转站变量。
PERF_PORT="${1:-$(env_port API_PORT 28000)}"

{
  log_header "check_chat_perf"
  PERF_PORT="$PERF_PORT" "$(python_cmd)" - <<'PY'
import os
import re
import time

import httpx

port = os.environ.get("PERF_PORT", "8000")
base = f"http://127.0.0.1:{port}"
user = os.environ.get("REFLEXLEARN_HEALTH_USER", "admin")
pw = os.environ.get("REFLEXLEARN_HEALTH_PASSWORD", "reflexlearn-admin")

_LABEL_RE = re.compile(r"reflexlearn_llm_requests_total\{([^}]*)\}\s+([0-9.eE+]+)")
_KV_RE = re.compile(r'(\w+)="([^"]*)"')


def llm_counters() -> dict:
    """按 task_type/status 解析 LLM 请求计数（prometheus 带标签行）。"""
    try:
        with httpx.Client(trust_env=False, timeout=10) as c:
            txt = c.get(f"{base}/metrics").text
    except Exception:
        return {}
    out: dict[str, float] = {}
    for line in txt.splitlines():
        m = _LABEL_RE.match(line)
        if not m:
            continue
        labels = dict(_KV_RE.findall(m.group(1)))
        key = f"{labels.get('task_type', '?')}/{labels.get('status', '?')}"
        out[key] = out.get(key, 0.0) + float(m.group(2))
    return out


def diff(before: dict, after: dict) -> dict:
    keys = set(before) | set(after)
    return {
        k: int(after.get(k, 0) - before.get(k, 0))
        for k in sorted(keys)
        if int(after.get(k, 0) - before.get(k, 0))
    }


with httpx.Client(trust_env=False, timeout=30) as c:
    r = c.post(f"{base}/api/auth/login", json={"username": user, "password": pw})
    if r.status_code != 200:
        raise SystemExit(f"[FAIL] login status {r.status_code}")
    token = r.json().get("access_token", "")
headers = {"Authorization": f"Bearer {token}"} if token else {}

before = llm_counters()
body = {"message": "线性回归从入门到精通", "user_id": user}
t0 = time.time()
firsts: dict[str, float] = {}
frames: dict[str, int] = {}
resource_card_times: list[float] = []

with httpx.Client(trust_env=False, timeout=240) as c:
    with c.stream("POST", f"{base}/api/chat", json=body, headers=headers) as resp:
        if resp.status_code != 200:
            raise SystemExit(f"[FAIL] chat status {resp.status_code}")
        for line in resp.iter_lines():
            if not line or not line.startswith("event:"):
                continue
            ev = line[6:].strip()
            frames[ev] = frames.get(ev, 0) + 1
            el = round(time.time() - t0, 2)
            firsts.setdefault(ev, el)
            if ev == "resource_card":
                resource_card_times.append(el)
            if ev == "done":
                break

after = llm_counters()
signal = firsts.get("agent_step") or firsts.get("session")
ttfc = firsts.get("resource_card")
ttfd = firsts.get("resource_delta")
total = firsts.get("done")
delta = diff(before, after)

print(f"[chat-perf] first_signal={signal}s  TTFC(first resource_card)={ttfc}s  total(done)={total}s")
# TTFD = 用户看到第一个字的时间，才是真实体感起点；TTFC 是整张卡落定的时间。
print(f"[chat-perf] TTFD(first resource_delta)={ttfd}s  delta_frames={frames.get('resource_delta', 0)}")
print(f"[chat-perf] frames={frames}")
if resource_card_times:
    # 时间分布：若生成阶段边算边发，首末跨度大；若都挤末尾=生成不流式、靠 assemble replay
    print(
        f"[chat-perf] resource_card 分布: 首={resource_card_times[0]}s "
        f"末={resource_card_times[-1]}s 共{len(resource_card_times)}帧"
    )
print(f"[chat-perf] LLM 差分(task_type/status): {delta or '无(中转站不可达/全降级)'}")

if total is None:
    raise SystemExit("[FAIL] no done frame (chat did not complete)")
print("[OK] chat perf captured")
PY
} 2>&1 | tee -a "$LOG_DIR/check_chat_perf.log"
