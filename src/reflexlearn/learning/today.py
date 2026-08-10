from __future__ import annotations

from collections.abc import Mapping, Sequence
from typing import Literal

from pydantic import BaseModel, Field


ResourceKind = Literal[
    "external_video",
    "ai_document",
    "quiz",
    "official_doc",
    "oer",
    "user_upload",
]
PathStatus = Literal["done", "current", "next"]

RESOURCE_KINDS = {
    "external_video",
    "ai_document",
    "quiz",
    "official_doc",
    "oer",
    "user_upload",
}


class TodayTask(BaseModel):
    title: str
    reason: str
    estimated_minutes: int = 30
    space_id: str = ""
    space_name: str = ""
    path_node: str = ""
    primary_action: str = "开始今日学习"


class TodayResource(BaseModel):
    id: str
    type: ResourceKind
    title: str
    provider: str
    source_label: str
    estimated_minutes: int
    reason: str
    href: str
    embed_url: str = ""
    usage_mode: str = "personal"
    source_policy: str = "owned_or_generated"


class TodayPathResource(BaseModel):
    resource_id: str
    title: str
    type: str = ""
    pinned: bool = False  # 用户显式绑定到本节点


class TodayLearningPathNode(BaseModel):
    id: str
    title: str
    status: PathStatus
    summary: str
    item_id: int | None = None  # 真实 path_item id；合成示意节点为 None
    resources: list[TodayPathResource] = Field(default_factory=list)


class ProfileSignal(BaseModel):
    label: str
    value: str


class TodayReviewItem(BaseModel):
    topic: str
    reason: str
    due_label: str


class TodaySummary(BaseModel):
    user_id: str
    greeting: str = "继续推进你的学习主线"
    current_goal: str = ""
    progress: float = 0.0
    main_task: TodayTask
    path_nodes: list[TodayLearningPathNode] = Field(default_factory=list)
    path_recommendation: str = ""
    resources: list[TodayResource] = Field(default_factory=list)
    tutor_prompt: str = "我可以用几个问题判断你是否真的理解当前知识点。"
    quick_actions: list[ProfileSignal] = Field(default_factory=list)
    profile_signals: list[ProfileSignal] = Field(default_factory=list)
    review_queue: list[TodayReviewItem] = Field(default_factory=list)
    degraded: list[str] = Field(default_factory=list)


def build_today_summary(
    *,
    user_id: str,
    spaces: Sequence[Mapping[str, object]],
    resources: Sequence[Mapping[str, object]],
    mistakes: Sequence[Mapping[str, object]],
    profile: Mapping[str, object],
    path_items: Sequence[Mapping[str, object]] | None = None,
    degraded: Sequence[str] | None = None,
) -> TodaySummary:
    active_space = _select_active_space(spaces)
    goal = _text(profile.get("goal") or active_space.get("title"), "创建你的第一个学习目标")
    weak_points = _weak_points(profile)
    first_weak = weak_points[0] if weak_points else "当前核心概念"
    next_topic = _next_practice_topic(goal, weak_points)
    progress = _float(profile.get("progress"), 0.0)

    real_nodes = _real_path_nodes(path_items or [])
    if real_nodes:
        done = sum(1 for node in real_nodes if node.status == "done")
        progress = round(done / len(real_nodes), 4)

    main_task = TodayTask(
        title=f"先补齐{first_weak}，再进入{next_topic}",
        reason=f"系统根据你的画像和错题记录，建议先处理“{first_weak}”，再进入针对性练习。",
        estimated_minutes=32,
        space_id=_text(active_space.get("space_id")),
        space_name=_text(active_space.get("title"), goal),
        path_node=first_weak,
    )

    mapped_resources = [_resource_from_mapping(item) for item in resources[:4]]
    if not mapped_resources:
        mapped_resources = _fallback_resources(first_weak)

    return TodaySummary(
        user_id=user_id,
        current_goal=goal,
        progress=progress,
        main_task=main_task,
        path_nodes=real_nodes or _path_nodes(first_weak, next_topic),
        path_recommendation=f"先处理“{first_weak}”可以降低后续学习负担。",
        resources=mapped_resources,
        quick_actions=[
            ProfileSignal(label="上传课程资料", value="/knowledge"),
            ProfileSignal(label="录入一道错题", value="/mistakes"),
            ProfileSignal(label="生成一组练习", value="/chat"),
            ProfileSignal(label="创建学习目标", value="/spaces"),
        ],
        profile_signals=_profile_signals(profile, goal, weak_points, first_weak, progress),
        review_queue=_review_queue(mistakes),
        degraded=list(degraded or []),
    )


def _select_active_space(spaces: Sequence[Mapping[str, object]]) -> Mapping[str, object]:
    for item in spaces:
        if _text(item.get("status"), "active") == "active":
            return item
    return spaces[0] if spaces else {}


def _weak_points(profile: Mapping[str, object]) -> list[str]:
    raw = profile.get("weak_points", [])
    if not isinstance(raw, Sequence) or isinstance(raw, str):
        return []
    return [_text(item) for item in raw if _text(item)]


def _next_practice_topic(goal: str, weak_points: Sequence[str]) -> str:
    if "梯度下降" in goal:
        return "梯度下降练习"
    if len(weak_points) > 1:
        return f"{weak_points[1]}练习"
    return "下一步练习"


def _resource_from_mapping(item: Mapping[str, object]) -> TodayResource:
    kind = _resource_kind(_text(item.get("type"), "ai_document"))
    resource_id = _text(item.get("resource_id") or item.get("id") or item.get("title"), kind)
    href = _text(item.get("href"), f"/resources/{resource_id}")
    return TodayResource(
        id=resource_id,
        type=kind,
        title=_text(item.get("title") or item.get("type"), "学习资源"),
        provider=_text(item.get("provider"), "ReflexLearn"),
        source_label=_text(item.get("source_label"), _source_label(kind)),
        estimated_minutes=_int(item.get("estimated_minutes"), 10),
        reason=_text(item.get("reason"), "与当前学习目标相关。"),
        href=href,
        embed_url=_text(item.get("embed_url")),
        usage_mode=_text(item.get("usage_mode"), "personal"),
        source_policy=_text(item.get("source_policy"), "owned_or_generated"),
    )


def _review_queue(mistakes: Sequence[Mapping[str, object]]) -> list[TodayReviewItem]:
    open_items = [item for item in mistakes if _text(item.get("status"), "open") == "open"]
    selected = open_items or list(mistakes)
    return [
        TodayReviewItem(
            topic=_text(item.get("concept"), "待复习知识点"),
            reason="这类错题会影响后续路径推进，建议今天完成一次短复盘。",
            due_label="今天" if idx == 0 else "本周",
        )
        for idx, item in enumerate(selected[:3])
    ]


def _profile_signals(
    profile: Mapping[str, object],
    goal: str,
    weak_points: Sequence[str],
    first_weak: str,
    progress: float,
) -> list[ProfileSignal]:
    preferences = profile.get("preferences", {})
    resource_mix = ""
    if isinstance(preferences, Mapping):
        resource_mix = _text(preferences.get("resource_mix"), "视频讲解 + 五题短练习")
    return [
        ProfileSignal(label="学习偏好", value=resource_mix or "视频讲解 + 五题短练习"),
        ProfileSignal(label="当前薄弱点", value="、".join(weak_points[:3]) or first_weak),
        ProfileSignal(label="学习目标", value=goal),
        ProfileSignal(label="完成进度", value=f"{round(progress * 100)}%"),
    ]


def _real_path_nodes(
    path_items: Sequence[Mapping[str, object]],
) -> list[TodayLearningPathNode]:
    """真实 path_items → 路径节点：done 照搬，第一个未完成节点为 current，其余 next。"""
    nodes: list[TodayLearningPathNode] = []
    current_assigned = False
    for item in path_items:
        raw_status = _text(item.get("mastery_status"), "not_started")
        if raw_status == "done":
            status: PathStatus = "done"
        elif not current_assigned:
            status = "current"
            current_assigned = True
        else:
            status = "next"
        item_id = _int(item.get("item_id") or item.get("id"), 0)
        title = _text(item.get("concept") or item.get("objective"), "学习节点")
        raw_resources = item.get("resources")
        resources = [
            TodayPathResource(
                resource_id=_text(res.get("resource_id")),
                title=_text(res.get("title"), "学习资源"),
                type=_text(res.get("type")),
                pinned=bool(res.get("pinned")),
            )
            for res in (raw_resources if isinstance(raw_resources, Sequence) and not isinstance(raw_resources, str) else [])
            if isinstance(res, Mapping) and _text(res.get("resource_id"))
        ]
        nodes.append(
            TodayLearningPathNode(
                id=str(item_id or title),
                title=title,
                status=status,
                summary=_text(item.get("objective") or item.get("rationale"), "推进这一步。"),
                item_id=item_id or None,
                resources=resources,
            )
        )
    return nodes


def _path_nodes(first_weak: str, next_topic: str) -> list[TodayLearningPathNode]:
    return [
        TodayLearningPathNode(
            id="foundation",
            title="建立直觉",
            status="done",
            summary="完成概念背景、问题形式和基础例子。",
        ),
        TodayLearningPathNode(
            id="current",
            title=first_weak,
            status="current",
            summary=f"正在处理“{first_weak}”相关卡点。",
        ),
        TodayLearningPathNode(
            id="next",
            title=next_topic,
            status="next",
            summary="下一步进入针对性练习和迁移应用。",
        ),
    ]


def _fallback_resources(concept: str) -> list[TodayResource]:
    return [
        TodayResource(
            id="fallback-bilibili-search",
            type="external_video",
            title=f"{concept}视频讲解",
            provider="Bilibili",
            source_label="B 站视频",
            estimated_minutes=14,
            reason="先用中文视频建立直觉，再回到讲义和练习。",
            href=f"https://search.bilibili.com/all?keyword={concept}",
            usage_mode="metadata_only",
            source_policy="embed_or_redirect_only",
        )
    ]


def _resource_kind(kind: str) -> ResourceKind:
    if kind in RESOURCE_KINDS:
        return kind  # type: ignore[return-value]
    legacy = {"doc": "ai_document", "video": "external_video", "reading": "oer"}
    return legacy.get(kind, "ai_document")  # type: ignore[return-value]


def _source_label(kind: str) -> str:
    labels = {
        "external_video": "外部视频",
        "ai_document": "AI 讲解文档",
        "quiz": "针对练习",
        "official_doc": "官方资料",
        "oer": "开放课程",
        "user_upload": "个人资料",
    }
    return labels.get(kind, "学习资源")


def _text(value: object, default: str = "") -> str:
    text = str(value or "").strip()
    return text or default


def _int(value: object, default: int) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _float(value: object, default: float) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default
