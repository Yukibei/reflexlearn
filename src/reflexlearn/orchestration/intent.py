"""导师意图分流。

导师智能体处理学术答疑、学习项目状态查询、生成学习方案/路线/资源，并拒绝范围外请求。
分流先走高置信规则（零延迟），判不准再交给便宜档 LLM。

这里的规则表只是**快路径**，不承担正确性：漏掉的一律落到 LLM，LLM 再失败则回落
`academic_qa`。降级方向是刻意选的——答疑只花一次外呼，而误判成 learning_plan 会
白跑十几次 LLM 并凭空建出一个学习目标（这正是旧版「8 个问候词精确匹配、漏了就走
完整链路」的根本毛病：判不准时倒向了代价最大的分支）。
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from enum import Enum

from pydantic import BaseModel

logger = logging.getLogger(__name__)


class TutorIntent(str, Enum):
    SMALL_TALK = "small_talk"
    ACADEMIC_QA = "academic_qa"
    WORKSPACE_QUERY = "workspace_query"
    LEARNING_PLAN = "learning_plan"
    OUT_OF_SCOPE = "out_of_scope"


@dataclass(frozen=True)
class IntentDecision:
    intent: TutorIntent
    source: str  # rule / llm / fallback
    reason: str = ""


class _IntentVerdict(BaseModel):
    """交给 LLM 填的结构，字段刻意只留两个，降低格式出错概率。"""

    intent: TutorIntent
    reason: str = ""


SMALL_TALK_REPLY = (
    "你好，我是你的学习导师。你可以直接问我一个学科问题，我会尽量讲清楚；"
    "也可以告诉我想系统学习的主题，我来帮你生成学习方案、路线和配套资源。"
)

OUT_OF_SCOPE_REPLY = (
    "抱歉，我是专注学习的导师，只处理学科与学习相关的问题。"
    "你可以问我某个知识点，或者让我帮你规划某个主题的学习路线。"
)

# 问候与附和是封闭集合，可以安全枚举；允许重复与尾随语气词，比精确匹配宽松。
# 刻意不做「消息很短就算寒暄」——「熵」「秩」这类单字学术词会被误伤，
# 短而不在表内的一律交给 LLM 判。
_GREETING_WORD = (
    r"(?:你好|您好|大家好|哈喽|哈啰|嗨+|hi+|hello+|hey+|yo|在吗|在么|"
    r"早上好|中午好|下午好|晚上好|早安|晚安|"
    r"谢谢|多谢|感谢|辛苦了|麻烦了|"
    r"好的|好嘞|好呀|行吧|收到|明白|知道了|懂了|没事了|"
    r"嗯+|哦+|噢+|唔+|额|呃|是的|对的|ok|okay|"
    r"再见|拜拜|bye)"
)
_GREETING = re.compile(
    rf"^(?:{_GREETING_WORD}[\s!！?？。,.，~、…啊呀哦嗯呐吗呢的了吧啦你您]*)+$",
    re.IGNORECASE,
)

# 学习方案是最贵的分支，模式写得偏严：必须出现「规划/系统学习」这类明确诉求。
_PLAN_PATTERNS = (
    re.compile(r"(想|要|准备|打算|希望|计划).{0,6}(学|入门|掌握|精通|提升|补一补)"),
    re.compile(r"学习(路线|路径|计划|方案|规划|大纲)"),
    re.compile(r"从.{0,12}入门到"),
    re.compile(r"(帮|给|替)我.{0,8}(规划|安排|设计|制定|梳理).{0,12}(学|课程|路线|计划|方案)"),
    re.compile(r"系统(地|性)?(学|学习|梳理|掌握|复习)"),
    re.compile(r"(备考|应试|复习)(计划|方案|安排)"),
)

# 项目状态查询必须带有“我的/下一步/当前”等个人上下文，避免把普通知识问答误送到
# 两阶段工具链。这里只收高置信表达，剩余语义交给分类模型。
_WORKSPACE_PATTERNS = (
    re.compile(r"(?:我|我的).{0,8}(?:学到哪|学习进度|学习目标|学习路径|错题|薄弱|弱项|掌握情况)"),
    re.compile(r"我.{0,4}(?:哪里|哪儿|哪些).{0,4}(?:薄弱|不会|没掌握)"),
    re.compile(r"(?:接下来|下一步|今天|现在).{0,6}(?:该|应该|要)?(?:学|做|复习)"),
    re.compile(r"(?:查看|看看|总结|分析).{0,8}我的.{0,8}(?:学习|进度|路径|错题|薄弱)"),
)

_CLASSIFIER_SYSTEM = (
    "你是学习导师系统的意图分类器。判断学生这句话属于哪一类：\n"
    "- small_talk：寒暄、问候、感谢、附和，没有实际学习诉求。\n"
    "- academic_qa：针对某个知识点、题目或代码的具体提问，回答一次即可。\n"
    "- workspace_query：询问自己的学习目标、路径进度、薄弱点、错题或下一步行动。\n"
    "- learning_plan：希望系统学习某个主题，需要学习方案、路线或成套资源。\n"
    "- out_of_scope：与学科学习无关的请求，例如闲聊八卦、写作代笔、生活事务。\n"
    '只输出 JSON，格式为 {"intent": "...", "reason": "..."}。'
    "判不准时优先选 academic_qa；只有明确要求成套学习安排时才选 learning_plan。"
)


def rule_intent(message: str) -> IntentDecision | None:
    """只在高置信时返回结论，其余返回 None 交给 LLM。"""
    text = message.strip()
    if not text:
        return IntentDecision(TutorIntent.SMALL_TALK, "rule", "empty")

    if _GREETING.match(text):
        return IntentDecision(TutorIntent.SMALL_TALK, "rule", "greeting")

    for pattern in _WORKSPACE_PATTERNS:
        if pattern.search(text):
            return IntentDecision(TutorIntent.WORKSPACE_QUERY, "rule", pattern.pattern)

    for pattern in _PLAN_PATTERNS:
        if pattern.search(text):
            return IntentDecision(TutorIntent.LEARNING_PLAN, "rule", pattern.pattern)
    return None


async def classify_intent(message: str, *, gateway=None, settings=None) -> IntentDecision:
    decided = rule_intent(message)
    if decided is not None:
        return decided

    if settings is None:
        from reflexlearn.common.config import get_settings

        settings = get_settings()
    if not getattr(settings, "enable_llm_intent", True) or gateway is None:
        return IntentDecision(TutorIntent.ACADEMIC_QA, "fallback", "llm_intent_disabled")

    try:
        completion = await gateway.complete(
            [
                {"role": "system", "content": _CLASSIFIER_SYSTEM},
                {"role": "user", "content": message[:400]},
            ],
            task_type="judgment",
            schema=_IntentVerdict,
            temperature=0.0,
        )
        verdict = _IntentVerdict.model_validate_json(completion.text)
        return IntentDecision(verdict.intent, "llm", verdict.reason[:120])
    except Exception as exc:
        logger.info("intent classify degraded (%s) -> academic_qa", type(exc).__name__)
    return IntentDecision(TutorIntent.ACADEMIC_QA, "fallback", "llm_unavailable")


def direct_reply_for(intent: TutorIntent) -> str | None:
    """无需任何外呼即可答复的意图。"""
    if intent is TutorIntent.SMALL_TALK:
        return SMALL_TALK_REPLY
    if intent is TutorIntent.OUT_OF_SCOPE:
        return OUT_OF_SCOPE_REPLY
    return None
