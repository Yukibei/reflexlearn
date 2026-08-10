from __future__ import annotations

from pydantic import BaseModel, Field
from typing_extensions import NotRequired, TypedDict


class SessionResource(TypedDict):
    type: str
    content: str
    concept: str
    title: str
    task_id: NotRequired[str]
    quality_score: NotRequired[float | None]


class SessionPathStep(TypedDict):
    sequence: int
    task_id: str
    resource_type: str
    concept: NotRequired[str]
    objective: NotRequired[str]
    rationale: NotRequired[str]
    difficulty: NotRequired[float]


class SpacePathStep(BaseModel):
    sequence: int = 0
    task_ref: str = ""
    resource_type: str = ""
    concept: str = ""
    objective: str = ""
    rationale: str = ""
    difficulty: float = 0.0
    mastery_status: str = "not_started"


class SpaceResource(BaseModel):
    resource_id: str
    type: str
    title: str = ""
    concept: str = ""
    content: str = ""
    quality_score: float | None = None


class SpaceDetail(BaseModel):
    space_id: str
    user_id: str
    tenant_id: str
    title: str
    course: str = ""
    status: str = "active"
    progress: float = 0.0
    path_summary: str = ""
    path_strategy: str = ""
    steps: list[SpacePathStep] = Field(default_factory=list)
    resources: list[SpaceResource] = Field(default_factory=list)
    degraded: list[str] = Field(default_factory=list)


class SessionOutcome(BaseModel):
    resources: list[SessionResource] = Field(default_factory=list)
    path_steps: list[SessionPathStep] = Field(default_factory=list)
    path_summary: str = ""
    path_strategy: str = ""
