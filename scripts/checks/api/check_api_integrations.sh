#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPTS_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPTS_ROOT/_lib.sh"

ensure_logs
cd_root
use_local_network
use_python_defaults
export API_PORT="${1:-${API_PORT:-$(env_port API_PORT 28000)}}"

{
  log_header "check_api_integrations"
  "$(python_cmd)" - "$API_PORT" <<'PY'
import asyncio
import os
import time
import sys

import httpx

API = f"http://127.0.0.1:{sys.argv[1]}/api"
AUTH_USER = os.getenv("REFLEXLEARN_HEALTH_USER", "admin")
AUTH_PASSWORD = os.getenv("REFLEXLEARN_HEALTH_PASSWORD", "reflexlearn-admin")


async def wait_api(client: httpx.AsyncClient) -> None:
    deadline = time.time() + 60
    last_error = None
    while time.time() < deadline:
        try:
            resp = await client.get(f"{API}/health")
            if resp.status_code == 200 and resp.json().get("status") == "ok":
                print("[OK] api health")
                return
        except Exception as e:
            last_error = e
        await asyncio.sleep(1)
    raise RuntimeError(f"api health timeout: {last_error}")


async def login_headers(client: httpx.AsyncClient) -> dict[str, str]:
    resp = await client.post(
        f"{API}/auth/login",
        json={"username": AUTH_USER, "password": AUTH_PASSWORD},
    )
    resp.raise_for_status()
    token = resp.json()["access_token"]
    print("[OK] api auth login")
    return {"Authorization": f"Bearer {token}"}


async def check_upload(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    raw = b"""# Linear Regression Health Check

Linear regression learns a linear mapping from features to a target.
Gradient descent updates parameters by following the negative gradient.
Regularization can reduce overfitting when models are too flexible.
"""
    files = {"file": ("health_linear_regression.md", raw, "text/markdown")}
    data = {
        "course_id": "health",
        "visibility": "public",
        "title": "Linear Regression Health Check",
        "enable_contextual": "false",
        "enable_graph_build": "false",
    }
    resp = await client.post(
        f"{API}/knowledge/upload",
        files=files,
        data=data,
        headers=headers,
        timeout=180,
    )
    resp.raise_for_status()
    result = resp.json()
    if result.get("chunks", 0) < 1:
        raise RuntimeError(f"upload produced no chunks: {result}")
    if result.get("qdrant_written", 0) < 1:
        raise RuntimeError(f"upload did not write qdrant: {result}")
    if result.get("pg_written") is not True:
        raise RuntimeError(f"upload did not write pg: {result}")
    print(
        "[OK] knowledge upload "
        f"chunks={result['chunks']} embedded={result['embedded']} "
        f"qdrant={result['qdrant_written']} pg={result['pg_written']}"
    )


async def check_video(client: httpx.AsyncClient, headers: dict[str, str]) -> None:
    resp = await client.post(
        f"{API}/video/jobs",
        json={"storyboard": "Scene 1: Explain linear regression with a simple chart."},
        headers=headers,
    )
    resp.raise_for_status()
    job_id = resp.json()["job_id"]

    deadline = time.time() + 20
    latest = {}
    while time.time() < deadline:
        check = await client.get(f"{API}/video/jobs/{job_id}", headers=headers)
        check.raise_for_status()
        latest = check.json()
        if latest.get("status") in {"done", "degraded", "failed"}:
            break
        await asyncio.sleep(0.5)

    if latest.get("status") != "degraded":
        raise RuntimeError(f"expected storyboard degradation without SeeDance key: {latest}")
    print(f"[OK] video job degraded honestly job_id={job_id}")


async def main() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await wait_api(client)
        headers = await login_headers(client)
        await check_upload(client, headers)
        await check_video(client, headers)


asyncio.run(main())
PY
} 2>&1 | tee -a "$LOG_DIR/check_api_integrations.log"
