"""意图分流对主链路的影响：谁能进 run_session、谁能沉淀学习目标。

真实 learning_plan 会话要跑十几次 LLM、耗时十分钟以上，不适合做回归；
这里用假的 run_session 锁住分流契约本身——问答类绝不进图、也绝不建目标，
learning_plan 才走完整链路并沉淀。
"""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

import reflexlearn.api.routes.chat as chat_route
from reflexlearn.api.app import create_app
from reflexlearn.common.auth import CurrentUser, issue_token
from reflexlearn.common.config import Settings
from reflexlearn.learning.spaces import reset_space_store_for_tests


@pytest.fixture(autouse=True)
def _isolated(monkeypatch):
    import reflexlearn.common.db as db

    async def _no_pg():
        raise RuntimeError("pg disabled in unit tests")

    monkeypatch.setattr(db, "get_pg_pool", _no_pg)
    reset_space_store_for_tests()
    yield
    reset_space_store_for_tests()
    chat_route.reset_llm_for_tests()


def _headers():
    token = issue_token(CurrentUser(user_id="s1", tenant_id="default", role="student"), Settings())
    return {"Authorization": f"Bearer {token}"}


class _SpyGraph:
    """记录是否被调用；产出一份足以触发沉淀的资源 + 路径。"""

    def __init__(self):
        self.called = False

    async def __call__(self, message, user_id, session_id, tenant_id, **_kw):
        self.called = True
        yield {
            "assemble": {
                "resource_bundle": {
                    "total": 1,
                    "resources": [{"type": "doc", "task_id": "t1", "content": "极限的定义…"}],
                }
            }
        }
        yield {
            "path_plan": {
                # SessionPathStep 的必填三件套：sequence / task_id / resource_type，
                # 缺一项沉淀就会 ValidationError（真实 path_plan 输出是带全的）。
                "learning_path": [
                    {"task_id": "t1", "sequence": 1, "resource_type": "doc", "concept": "极限"}
                ],
                "path_summary": "先补极限再学导数",
                "path_strategy": "由浅入深",
            }
        }


class _BrokenLLM:
    """分类外呼失败 → 必须回落 academic_qa，而不是最贵的 learning_plan。"""

    async def complete(self, messages, **kwargs):
        raise RuntimeError("relay 502")


def test_learning_plan_runs_graph_and_persists_space(monkeypatch):
    graph = _SpyGraph()
    monkeypatch.setattr(chat_route, "run_session", graph)
    client = TestClient(create_app())

    resp = client.post(
        "/api/chat", json={"message": "我想系统学习微积分"}, headers=_headers()
    )

    assert resp.status_code == 200
    assert graph.called is True
    assert "event: space_saved" in resp.text
    assert "event: learning_path" in resp.text


def test_small_talk_neither_runs_graph_nor_creates_space(monkeypatch):
    graph = _SpyGraph()
    monkeypatch.setattr(chat_route, "run_session", graph)
    client = TestClient(create_app())

    resp = client.post("/api/chat", json={"message": "你好呀"}, headers=_headers())

    assert resp.status_code == 200
    assert graph.called is False
    assert "event: space_saved" not in resp.text
    assert "学习导师" in resp.text


def test_academic_qa_answers_without_creating_space(monkeypatch):
    graph = _SpyGraph()
    monkeypatch.setattr(chat_route, "run_session", graph)
    chat_route.set_llm_for_tests(_BrokenLLM())
    client = TestClient(create_app())

    resp = client.post(
        "/api/chat", json={"message": "这道极限题为什么用洛必达"}, headers=_headers()
    )

    assert resp.status_code == 200
    # 分类外呼失败 → academic_qa；答疑外呼同样失败 → 离线占位，但绝不建学习目标
    assert graph.called is False
    assert "event: space_saved" not in resp.text
    assert "event: assistant_message" in resp.text
