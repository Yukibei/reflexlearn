from __future__ import annotations

import logging

from langgraph.graph import StateGraph, START, END
from langgraph.types import Send

from reflexlearn.orchestration.state import AgentState
from reflexlearn.common.config import get_settings
from reflexlearn.orchestration.harness import harness_guard
from reflexlearn.orchestration.nodes.core.profile import profile_node
from reflexlearn.orchestration.nodes.core.planner import planner_node
from reflexlearn.orchestration.nodes.core.generator import generate_resource
from reflexlearn.orchestration.nodes.core.gate import gate_node, gate_route
from reflexlearn.orchestration.nodes.core.assemble import assemble_node
from reflexlearn.orchestration.nodes.reflection.critic import critic_node
from reflexlearn.orchestration.nodes.collaboration.debate import debate_node, judge_node
from reflexlearn.orchestration.nodes.reflection.metacognition import metacognition_node, metacognition_route
from reflexlearn.orchestration.nodes.collaboration.pipeline import pipeline_node
from reflexlearn.orchestration.nodes.planning.path_plan import path_plan_node
from reflexlearn.memory.manager import MemoryManager, recall_memory_node
from reflexlearn.orchestration.persist import (
    drain_persist_tasks,  # noqa: F401 - re-exported for tests and graceful shutdown
    persist_session,
    spawn_persist,
)

from reflexlearn.skills.retrieve import RetrieveSkill
from reflexlearn.skills.code_gen import CodeGenSkill
from reflexlearn.skills.doc_gen import DocGenSkill
from reflexlearn.skills.mindmap_gen import MindmapGenSkill
from reflexlearn.skills.quality_check import QualityCheckSkill
from reflexlearn.skills.quiz_gen import QuizGenSkill
from reflexlearn.skills.reading_gen import ReadingGenSkill
from reflexlearn.skills.video_gen import VideoGenSkill
from reflexlearn.skills.path_plan import PathPlanSkill
from reflexlearn.llm_gateway.gateway import LLMGateway


logger = logging.getLogger(__name__)

def build_graph(llm: LLMGateway | None = None):
    if llm is None:
        llm = LLMGateway()
    settings = get_settings()

    retrieve_skill = RetrieveSkill()
    doc_gen_skill = DocGenSkill(llm)
    quiz_gen_skill = QuizGenSkill(llm)
    mindmap_gen_skill = MindmapGenSkill(llm)
    code_gen_skill = CodeGenSkill(llm)
    reading_gen_skill = ReadingGenSkill(llm)
    video_gen_skill = VideoGenSkill(llm)
    quality_skill = QualityCheckSkill(llm if settings.enable_llm_quality_check else None)
    path_plan_skill = PathPlanSkill(llm)
    memory_manager = MemoryManager()

    skills = {
        "retrieve": retrieve_skill,
        "doc_gen": doc_gen_skill,
        "quiz_gen": quiz_gen_skill,
        "mindmap_gen": mindmap_gen_skill,
        "code_gen": code_gen_skill,
        "reading_gen": reading_gen_skill,
        "video_gen": video_gen_skill,
        "quality_check": quality_skill,
        "path_plan": path_plan_skill,
    }

    async def recall_with_memory(state: AgentState) -> dict:
        state_with_memory = {**state, "_memory_manager": memory_manager}
        return await recall_memory_node(state_with_memory)

    async def profile_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await profile_node(state_with_llm)

    async def planner_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await planner_node(state_with_llm)

    async def generator_with_skills(state: AgentState) -> dict:
        state_with_skills = {**state, "_skills": skills}
        return await generate_resource(state_with_skills)

    async def critic_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await critic_node(state_with_llm)

    async def debate_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await debate_node(state_with_llm)

    async def judge_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await judge_node(state_with_llm)

    async def metacognition_with_llm(state: AgentState) -> dict:
        state_with_llm = {**state, "_llm": llm}
        return await metacognition_node(state_with_llm)

    async def pipeline_with_skills(state: AgentState) -> dict:
        state_with_skills = {**state, "_skills": skills}
        return await pipeline_node(state_with_skills)

    async def path_plan_with_skills(state: AgentState) -> dict:
        state_with_skills = {**state, "_skills": skills}
        return await path_plan_node(state_with_skills)

    g = StateGraph(AgentState)

    g.add_node("profile", harness_guard(profile_with_llm))
    g.add_node("recall", harness_guard(recall_with_memory))
    g.add_node("planner", harness_guard(planner_with_llm))
    g.add_node("generate_resource", harness_guard(generator_with_skills))
    g.add_node("gate", harness_guard(gate_node))
    g.add_node("critic", harness_guard(critic_with_llm))
    g.add_node("debate", harness_guard(debate_with_llm))
    g.add_node("judge", harness_guard(judge_with_llm))
    g.add_node("metacognition", harness_guard(metacognition_with_llm))
    g.add_node("pipeline", harness_guard(pipeline_with_skills))
    g.add_node("assemble", harness_guard(assemble_node))
    g.add_node("path_plan", harness_guard(path_plan_with_skills))

    g.add_edge(START, "profile")
    g.add_edge("profile", "recall")
    g.add_edge("recall", "planner")
    g.add_conditional_edges("planner", dispatch_route, ["generate_resource", "pipeline"])
    g.add_edge("generate_resource", "gate")
    g.add_edge("pipeline", "gate")
    g.add_conditional_edges(
        "gate",
        gate_route,
        {
            "critic": "critic",
            "debate": "debate",
            "metacognition": "metacognition",
            "assemble": "assemble",
        },
    )
    g.add_edge("critic", "planner")
    g.add_edge("debate", "judge")
    g.add_edge("judge", "assemble")
    g.add_conditional_edges("metacognition", metacognition_route, ["generate_resource", "assemble"])
    g.add_edge("assemble", "path_plan")
    g.add_edge("path_plan", END)

    return g.compile()


def fan_out(state: AgentState):
    tasks = [task for task in state.get("plan", []) if task.get("status") == "pending"]
    if not tasks:
        return []
    return [
        Send(
            "generate_resource",
            {
                **state,
                "_current_task": task,
            },
        )
        for task in tasks
    ]


def dispatch_route(state: AgentState):
    """Planner 出口分流：pipeline 模式把整条链交给 pipeline 节点串行执行；
    其余（central/默认/None）走 fan_out 并行扇出——与改造前逐字节等价，保证零回归。"""
    if state.get("collab_mode") == "pipeline":
        pending = [t for t in state.get("plan", []) if t.get("status") == "pending"]
        if not pending:
            return []
        return [Send("pipeline", {**state})]
    return fan_out(state)


async def run_session(
    message: str,
    user_id: str = "anonymous",
    session_id: str = "",
    tenant_id: str = "default",
    resource_type_hints: list[str] | None = None,
):
    settings = get_settings()
    multi_turn = getattr(settings, "enable_multi_turn", True)
    scoped_session_id = ""

    # ① LOAD：从 Redis 读历史短期记忆（多轮）。关闭多轮 / 无 sid / Redis 挂 → 空（降级单轮）。
    prior_messages: list[dict] = []
    summary_layers: list[str] = []
    prior_profile: dict = {}
    if multi_turn and session_id:
        from reflexlearn.memory import session_store

        scoped_session_id = session_store.scoped_session_id(
            session_id,
            user_id=user_id,
            tenant_id=tenant_id,
        )
        hist = await session_store.load(scoped_session_id)
        prior_messages = hist["messages"]
        summary_layers = hist["summary_layers"]
        prior_profile = await session_store.load_profile(user_id, tenant_id=tenant_id)

    llm = LLMGateway()
    graph = build_graph(llm)
    initial_state: AgentState = {
        "user_id": user_id,
        "session_id": session_id,
        "acl": {"user_id": user_id, "tenant_id": tenant_id, "visibility": ["public"]},
        "messages": prior_messages + [{"role": "user", "content": message}],
        "summary_layers": summary_layers,
        "learner_profile": prior_profile,
        "learning_goal": message,
        "collab_mode": "central",
        "resource_type_hints": resource_type_hints or [],
        "plan": [],
        "completed": [],
        "reflections": [],
        "iteration": 0,
        "replan_count": 0,
        "token_used": 0,
        "halt_reason": None,
        "conflict": None,
        "debate_rounds": None,
        "debate_verdict": None,
        "resource_bundle": None,
        "learning_path": None,
        "path_summary": None,
        "path_strategy": None,
    }

    # 旁路收集 assemble 的资源包摘要，作为本轮 assistant 轮写入 Redis（不改 yield 行为）
    assistant_summary: str | None = None
    final_profile: dict = prior_profile
    # stream_mode=["updates","custom"]：updates=节点输出（原契约不变），custom=生成增量
    # （PERF-A，generator 经 get_stream_writer 上抛）。custom 帧包成 {"__stream__": ...} yield，
    # chat 层转 resource_delta SSE；非 custom 帧仍是原 {node_name: output} dict。
    async for mode, chunk in graph.astream(initial_state, stream_mode=["updates", "custom"]):
        if mode == "custom":
            yield {"__stream__": chunk}
            continue
        event = chunk
        for node_output in event.values():
            if isinstance(node_output, dict) and node_output.get("resource_bundle"):
                total = node_output["resource_bundle"].get("total", 0)
                assistant_summary = f"[已生成 {total} 个学习资源]"
            if isinstance(node_output, dict) and node_output.get("learner_profile"):
                final_profile = node_output["learner_profile"]
        yield event

    # ② PERSIST：后台化（PERF-C）。done 帧不再等待 Redis 写回 / 递归摘要 LLM / promote / autogrow，
    # 这些在 done 之后的后台 task 里跑（全程降级，异常吞掉）。单测用 drain_persist_tasks() 收尾。
    if multi_turn and scoped_session_id:
        spawn_persist(
            persist_session(
                scoped_session_id=scoped_session_id,
                message=message,
                user_id=user_id,
                tenant_id=tenant_id,
                session_id=session_id,
                prior_messages=prior_messages,
                summary_layers=summary_layers,
                assistant_summary=assistant_summary,
                final_profile=final_profile,
                settings=settings,
                llm=llm,
            )
        )
