"""PERF-A · /chat 把 generator 增量（__stream__）转成 resource_delta SSE 帧。

消息统一用「我想学微积分」：它命中意图分流的 learning_plan 规则，不触发 LLM 分类，
测试因此保持确定性且不依赖外呼。换成其他措辞会落到问答分支，压根不进 run_session。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from reflexlearn.api.app import create_app
from reflexlearn.common.auth import CurrentUser, issue_token
from reflexlearn.common.config import Settings


@pytest.fixture(autouse=True)
def _no_pg(monkeypatch):
    import reflexlearn.common.db as db

    async def _none():
        return None

    monkeypatch.setattr(db, "get_pg_pool", _none)


def _headers():
    token = issue_token(CurrentUser(user_id="s1", tenant_id="default", role="student"), Settings())
    return {"Authorization": f"Bearer {token}"}


def test_stream_delta_becomes_resource_delta_sse(monkeypatch):
    import reflexlearn.api.routes.chat as chat_route

    async def _streaming(message, user_id, session_id, tenant_id, **_kw):
        yield {"__stream__": {"task_id": "t1", "type": "doc", "delta": "线性回归", "reset": False}}
        yield {"assemble": {"resource_bundle": {"total": 0, "resources": []}}}

    monkeypatch.setattr(chat_route, "run_session", _streaming)
    client = TestClient(create_app())
    resp = client.post("/api/chat", json={"message": "我想学微积分"}, headers=_headers())

    assert resp.status_code == 200
    assert "event: resource_delta" in resp.text
    assert "线性回归" in resp.text
    assert "t1" in resp.text


def test_stream_delta_secret_redacted(monkeypatch):
    import reflexlearn.api.routes.chat as chat_route

    async def _leaky_delta(message, user_id, session_id, tenant_id, **_kw):
        yield {
            "__stream__": {
                "task_id": "t1",
                "type": "doc",
                "delta": "密钥 sk-ABCDEFGH12345678 流出",
                "reset": False,
            }
        }

    monkeypatch.setattr(chat_route, "run_session", _leaky_delta)
    client = TestClient(create_app())
    resp = client.post("/api/chat", json={"message": "我想学微积分"}, headers=_headers())

    assert resp.status_code == 200
    assert "sk-ABCDEFGH12345678" not in resp.text
    assert "[REDACTED]" in resp.text
