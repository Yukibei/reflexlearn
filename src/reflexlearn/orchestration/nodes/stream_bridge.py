"""PERF-A · 生成增量到 LangGraph custom 通道的桥（中心化与流水线两种协作模式共用）。

流式此前只接在 `generate_resource` 上，而 planner 常把 collab_mode 判成 pipeline，
于是真实会话一帧增量都不出。桥抽到这里，两条路径共用同一实现，避免再次只改一边。
"""

from __future__ import annotations


def stream_writer():
    """取 LangGraph custom 流式 writer；非流式 run / 单测直调（无 run 上下文）→ None。"""
    try:
        from langgraph.config import get_stream_writer

        return get_stream_writer()
    except Exception:
        return None


def emit_delta(writer, task: dict, *, delta: str = "", reset: bool = False) -> None:
    """经 custom 通道上抛资源增量；带 task_id 供前端区分 fan-out 多路。写失败静默。"""
    try:
        writer(
            {
                "task_id": task.get("task_id", ""),
                "type": task.get("type", "doc"),
                "delta": delta,
                "reset": reset,
            }
        )
    except Exception:
        return


def sink_for(writer, task: dict):
    """构造绑定到某个 task 的增量回调。

    task 用默认参数绑定：流水线在 while 循环里复用同一个闭包变量，
    不绑定的话所有增量都会挂到最后一个 task 上。
    """
    return lambda delta, _task=task: emit_delta(writer, _task, delta=delta)
