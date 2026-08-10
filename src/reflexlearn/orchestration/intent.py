from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class DirectResponse:
    content: str


_GREETINGS = {
    "hi",
    "hello",
    "hey",
    "你好",
    "您好",
    "嗨",
    "哈喽",
    "在吗",
}


def resolve_direct_response(message: str) -> DirectResponse | None:
    normalized = message.strip().lower().rstrip("!！?？。,.，")
    if normalized not in _GREETINGS:
        return None
    return DirectResponse(
        content=(
            "你好，我是牛牛学习导师。你可以告诉我一个具体主题，"
            "或者直接选择上方的学习画像、路径、练习和资源动作。"
        )
    )
