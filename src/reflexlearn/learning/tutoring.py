"""导师答疑：单次轻量 LLM 直答。

`/tutor/ask` 浮窗与 `/chat` 的 academic_qa 分流共用这一条实现，避免同一能力两处维护。
与完整多智能体链路不同，这里只做一次外呼，追求秒级响应；外呼失败降级为离线引导占位，
绝不报错中断。
"""

from __future__ import annotations

import logging

from pydantic import BaseModel

from reflexlearn.memory import session_store
from reflexlearn.safety import SafetyGateway

logger = logging.getLogger(__name__)

OFFLINE_ANSWER = (
    "（离线辅导占位）当前 AI 服务暂不可用，先给你一个通用建议：\n"
    "1. 把问题拆成「概念定义 → 典型例子 → 易错点」三步自查；\n"
    "2. 如果是题目卡住，回到对应章节的讲解文档重读相关小节；\n"
    "3. 可以把这道题录入错题本，系统会在服务恢复后生成针对性补救资源。"
)

_SYSTEM = (
    "你是 ReflexLearn 的 1 对 1 学习导师，负责即时答疑。"
    "回答要求：直接给出解释，必要时给一个小例子；控制在 300 字以内；"
    "如果学生画像里有薄弱点与当前问题相关，结尾给一句针对性的复习建议。"
)


class TutorAnswer(BaseModel):
    answer: str
    degraded: bool = False


async def answer_question(
    question: str,
    *,
    user_id: str,
    tenant_id: str,
    gateway,
    context_hint: str = "",
) -> TutorAnswer:
    profile = await session_store.load_profile(user_id, tenant_id=tenant_id)
    context_parts: list[str] = []
    if profile:
        weak = "、".join(profile.get("weak_points", [])[:4])
        if weak:
            context_parts.append(f"学生薄弱点：{weak}")
        if profile.get("goal"):
            context_parts.append(f"学习目标：{profile['goal']}")
    if context_hint:
        context_parts.append(f"提问场景：{context_hint[:200]}")

    user_content = question
    if context_parts:
        user_content = "（上下文：" + "；".join(context_parts) + "）\n\n" + question

    try:
        completion = await gateway.complete(
            [
                {"role": "system", "content": _SYSTEM},
                {"role": "user", "content": user_content},
            ],
            task_type="tutoring",
            temperature=0.3,
        )
        answer = SafetyGateway().check_output(completion.text).redacted_text
        return TutorAnswer(answer=answer)
    except Exception as exc:
        logger.info("tutor answer degraded: %s", exc)
        return TutorAnswer(answer=OFFLINE_ANSWER, degraded=True)
