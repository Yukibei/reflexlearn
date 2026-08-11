"""导师意图分流测试。

最关键的一条是降级方向：规则判不准、LLM 又不可用时，必须回落 academic_qa
（一次外呼），绝不能回落 learning_plan（十几次外呼 + 凭空建学习目标）。
"""

import pytest

from reflexlearn.llm_gateway.models import Completion
from reflexlearn.orchestration.intent import (
    TutorIntent,
    classify_intent,
    direct_reply_for,
    rule_intent,
)


class _S:
    enable_llm_intent = True


class _NoLLM:
    enable_llm_intent = False


class _FakeGateway:
    def __init__(self, text: str = "", error: Exception | None = None):
        self.text = text
        self.error = error
        self.calls: list[dict] = []

    async def complete(self, messages, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return Completion(text=self.text)


@pytest.mark.parametrize(
    "message",
    ["hi", "你好", "嗯", "哦", "hi~", "你好呀", "谢谢啦", "在吗？", "好的，收到", "拜拜"],
)
def test_rule_marks_greetings_as_small_talk(message):
    decided = rule_intent(message)
    assert decided is not None and decided.intent is TutorIntent.SMALL_TALK


@pytest.mark.parametrize(
    "message",
    [
        "我想学线性回归",
        "帮我规划一份前端学习路线",
        "线性回归从入门到精通",
        "想系统学习机器学习",
        "给我制定一个备考方案",
    ],
)
def test_rule_marks_explicit_planning_as_learning_plan(message):
    decided = rule_intent(message)
    assert decided is not None and decided.intent is TutorIntent.LEARNING_PLAN


@pytest.mark.parametrize(
    "message",
    ["什么是梯度下降", "梯度下降", "这段代码为什么报错", "熵", "交叉熵和 KL 散度的区别"],
)
def test_rule_defers_academic_questions_to_llm(message):
    """学术提问（含「梯度下降」这类短词）不能被规则草率归类。"""
    assert rule_intent(message) is None


async def test_llm_verdict_is_used_when_rules_defer():
    gateway = _FakeGateway(text='{"intent": "learning_plan", "reason": "想成体系地学"}')

    decision = await classify_intent("我这学期得把概率论搞定", gateway=gateway, settings=_S())

    assert decision.intent is TutorIntent.LEARNING_PLAN
    assert decision.source == "llm"
    # 分类属于评判类任务，应走便宜档而不是主力生成模型
    assert gateway.calls[0]["task_type"] == "judgment"


async def test_llm_failure_falls_back_to_academic_qa_not_learning_plan():
    gateway = _FakeGateway(error=RuntimeError("relay 502"))

    decision = await classify_intent("帮我看看这道题", gateway=gateway, settings=_S())

    assert decision.intent is TutorIntent.ACADEMIC_QA
    assert decision.source == "fallback"


async def test_unparseable_llm_output_falls_back_to_academic_qa():
    gateway = _FakeGateway(text="我觉得这是 learning_plan（非 JSON）")

    decision = await classify_intent("帮我看看这道题", gateway=gateway, settings=_S())

    assert decision.intent is TutorIntent.ACADEMIC_QA
    assert decision.source == "fallback"


async def test_disabled_llm_intent_skips_outbound_call():
    gateway = _FakeGateway(text='{"intent": "learning_plan"}')

    decision = await classify_intent("随便说点什么", gateway=gateway, settings=_NoLLM())

    assert decision.intent is TutorIntent.ACADEMIC_QA
    assert gateway.calls == []


async def test_missing_gateway_does_not_crash():
    decision = await classify_intent("随便说点什么", gateway=None, settings=_S())

    assert decision.intent is TutorIntent.ACADEMIC_QA


async def test_rule_hit_never_calls_llm():
    gateway = _FakeGateway(text='{"intent": "out_of_scope"}')

    decision = await classify_intent("你好呀", gateway=gateway, settings=_S())

    assert decision.intent is TutorIntent.SMALL_TALK
    assert gateway.calls == []


def test_direct_reply_only_for_no_outbound_intents():
    assert direct_reply_for(TutorIntent.SMALL_TALK)
    assert direct_reply_for(TutorIntent.OUT_OF_SCOPE)
    assert direct_reply_for(TutorIntent.ACADEMIC_QA) is None
    assert direct_reply_for(TutorIntent.LEARNING_PLAN) is None
