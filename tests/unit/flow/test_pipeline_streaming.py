"""流水线协作模式下的 token 流式增量（PERF-A 补齐）。

历史 bug：流式只接在 generate_resource 上，而 planner 常把 collab_mode 判成 pipeline，
于是真实会话一帧 resource_delta 都不出。这里锁住两件事——流水线会推增量，
且多任务时增量必须挂到各自的 task_id 上（闭包若不绑定会全挂到最后一个 task）。
"""

import pytest

import reflexlearn.orchestration.nodes.collaboration.pipeline as pipeline_mod
from reflexlearn.orchestration.nodes.collaboration.pipeline import pipeline_node
from reflexlearn.skills.base import SkillResult
from tests.unit.flow.test_pipeline import base_state, make_skills, make_task


class StreamingGenSkill:
    """读 ctx.delta_sink 并逐段推增量的假生成 Skill（模拟 doc_gen 流式）。"""

    def __init__(self, pieces_by_task: dict[str, list[str]]):
        self.pieces_by_task = pieces_by_task

    async def run(self, inp, ctx):
        pieces = self.pieces_by_task.get(ctx.task_id, ["占位内容"])
        sink = getattr(ctx, "delta_sink", None)
        for piece in pieces:
            if sink:
                sink(piece)
        return SkillResult(ok=True, data={"content": "".join(pieces)})


class PassingQuality:
    async def run(self, inp, ctx):
        return SkillResult(ok=True, data={"passed": True, "issues": [], "fixable": True})


@pytest.mark.asyncio
async def test_pipeline_emits_deltas_through_stream_writer(monkeypatch):
    frames: list[dict] = []
    monkeypatch.setattr(pipeline_mod, "stream_writer", lambda: frames.append)

    plan = [make_task("t1")]
    skills = make_skills({"doc_gen": StreamingGenSkill({"t1": ["矩阵", "分解"]})}, PassingQuality())

    result = await pipeline_node(base_state(plan, skills))

    assert result["completed"][0]["status"] == "passed"
    assert frames[0]["reset"] is True
    assert [f["delta"] for f in frames if f["delta"]] == ["矩阵", "分解"]
    assert all(f["task_id"] == "t1" for f in frames)


@pytest.mark.asyncio
async def test_pipeline_deltas_bind_to_their_own_task(monkeypatch):
    """流水线在 while 循环里复用闭包变量，增量必须按 task 分路而不是全挂最后一个。"""
    frames: list[dict] = []
    monkeypatch.setattr(pipeline_mod, "stream_writer", lambda: frames.append)

    plan = [make_task("t1"), make_task("t2")]
    skills = make_skills(
        {"doc_gen": StreamingGenSkill({"t1": ["第一步"], "t2": ["第二步"]})},
        PassingQuality(),
    )

    await pipeline_node(base_state(plan, skills))

    by_task = {f["task_id"]: f["delta"] for f in frames if f["delta"]}
    assert by_task == {"t1": "第一步", "t2": "第二步"}


@pytest.mark.asyncio
async def test_pipeline_without_writer_still_generates(monkeypatch):
    """非流式 run（拿不到 writer）时不构造 sink，照常一次性生成，零回归。"""
    monkeypatch.setattr(pipeline_mod, "stream_writer", lambda: None)

    plan = [make_task("t1")]
    skills = make_skills({"doc_gen": StreamingGenSkill({"t1": ["完整内容"]})}, PassingQuality())

    result = await pipeline_node(base_state(plan, skills))

    assert result["completed"][0]["status"] == "passed"
    assert result["completed"][0]["content"] == "完整内容"
