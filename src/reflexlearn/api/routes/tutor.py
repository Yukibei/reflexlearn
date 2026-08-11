"""微型智能辅导：全局浮窗的即时答疑端点。

与 /chat 的完整多智能体链路不同，/tutor/ask 是单次轻量 LLM 调用：
带学习画像上下文直答，追求秒级响应；无凭证/外呼失败降级为
离线引导占位，绝不报错中断。答疑实现与 /chat 的 academic_qa 分流
共用 `learning.tutoring`，避免两处维护。
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from reflexlearn.api.deps import get_current_user
from reflexlearn.common.auth import CurrentUser
from reflexlearn.learning.tutoring import answer_question
from reflexlearn.llm_gateway.gateway import LLMGateway
from reflexlearn.safety import SafetyGateway

logger = logging.getLogger(__name__)
router = APIRouter()

_gateway: LLMGateway | None = None


def _get_gateway() -> LLMGateway:
    global _gateway
    if _gateway is None:
        _gateway = LLMGateway()
    return _gateway


def set_gateway_for_tests(gateway) -> None:
    global _gateway
    _gateway = gateway


def reset_gateway_for_tests() -> None:
    global _gateway
    _gateway = None


class TutorAskRequest(BaseModel):
    question: str
    context_hint: str = ""


class TutorReply(BaseModel):
    answer: str
    degraded: bool = False
    blocked: bool = False
    reasons: list[str] = []


@router.post("/tutor/ask")
async def tutor_ask(req: TutorAskRequest, user: CurrentUser = Depends(get_current_user)):
    decision = SafetyGateway().check_input(req.question)
    if not decision.allowed:
        return TutorReply(answer="", blocked=True, reasons=decision.reasons)

    result = await answer_question(
        req.question,
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        gateway=_get_gateway(),
        context_hint=req.context_hint,
    )
    return TutorReply(answer=result.answer, degraded=result.degraded)
