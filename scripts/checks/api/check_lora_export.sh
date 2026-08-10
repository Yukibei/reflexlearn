#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "check_lora_export"
  "$(python_cmd)" - "$API_PORT" <<'PY'
import asyncio
import json
import sys
import time
from pathlib import Path

import httpx

from reflexlearn.common.auth import CurrentUser, issue_token
from reflexlearn.common.config import Settings

API = f"http://127.0.0.1:{sys.argv[1]}/api"
USER_ID = "lora-u1"


def headers() -> dict[str, str]:
    token = issue_token(
        CurrentUser(user_id=USER_ID, tenant_id="default", role="student"),
        Settings(),
    )
    return {"Authorization": f"Bearer {token}"}


async def wait_api(client: httpx.AsyncClient) -> None:
    deadline = time.time() + 30
    while time.time() < deadline:
        try:
            resp = await client.get(f"{API}/health")
            if resp.status_code == 200:
                print("[OK] api health")
                return
        except Exception:
            pass
        await asyncio.sleep(1)
    raise RuntimeError("api health timeout")


async def seed_trace(client: httpx.AsyncClient) -> None:
    saw_useful_step = False
    try:
        async with client.stream(
            "POST",
            f"{API}/chat",
            json={"message": "为 LoRA 导出生成一条协作轨迹 token=local-secret"},
            headers=headers(),
            timeout=60,
        ) as resp:
            resp.raise_for_status()
            async for chunk in resp.aiter_text():
                useful_markers = (
                    '"step": "assemble"',
                    '"step":"assemble"',
                    '"step": "path_plan"',
                    '"step":"path_plan"',
                    "resource_card",
                    "learning_path",
                )
                if any(marker in chunk for marker in useful_markers):
                    saw_useful_step = True
                    break
    except httpx.ReadTimeout:
        pass
    if not saw_useful_step:
        raise RuntimeError("collaboration trace did not reach a useful non-session step")
    print("[OK] collaboration trace seeded")


async def export_samples(client: httpx.AsyncClient) -> dict:
    resp = await client.post(f"{API}/growth/lora-samples/export", headers=headers())
    resp.raise_for_status()
    data = resp.json()
    if data.get("sample_count", 0) < 1:
        raise RuntimeError(f"expected sample_count >= 1, got {data}")
    if not data.get("sanitized"):
        raise RuntimeError("export result is not sanitized")
    print(f"[OK] lora export sample_count={data['sample_count']}")
    return data


async def check_list(client: httpx.AsyncClient) -> None:
    resp = await client.get(f"{API}/growth/lora-samples", headers=headers())
    resp.raise_for_status()
    items = resp.json().get("items", [])
    if not items:
        raise RuntimeError("lora export list is empty")
    print("[OK] lora export list")


def check_jsonl(data: dict) -> None:
    path = Path(data["latest_file_path"])
    if not path.exists():
        raise RuntimeError(f"latest jsonl missing: {path}")
    content = path.read_text(encoding="utf-8")
    if USER_ID in content or "local-secret" in content or "Bearer " in content:
        raise RuntimeError("sensitive content leaked into lora jsonl")
    first = json.loads(content.splitlines()[0])
    roles = [item["role"] for item in first["messages"]]
    if roles != ["system", "user", "assistant"]:
        raise RuntimeError(f"unexpected roles: {roles}")
    print(f"[OK] lora jsonl sanitized path={path}")


async def main() -> None:
    async with httpx.AsyncClient(timeout=60) as client:
        await wait_api(client)
        await seed_trace(client)
        data = await export_samples(client)
        await check_list(client)
        check_jsonl(data)


asyncio.run(main())
PY
} 2>&1 | tee -a "$LOG_DIR/check_lora_export.log"
