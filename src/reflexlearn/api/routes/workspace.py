from __future__ import annotations

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from reflexlearn.api.acl import assert_object_access
from reflexlearn.api.deps import get_current_user
from reflexlearn.api.service_deps import safe_pg_pool
from reflexlearn.common.auth import CurrentUser
from reflexlearn.common.config import get_settings
from reflexlearn.learning.assets import LearningAssetStore, LearningResource
from reflexlearn.learning.bilibili_search import get_bili_client
from reflexlearn.learning.mdn_search import get_mdn_client, is_web_topic
from reflexlearn.learning.resource_detail import (
    ResourceStudyStore,
    StudyStatus,
    load_resource_detail,
    update_study_status,
)
from reflexlearn.learning.resource_discovery import (
    DEFAULT_PROVIDERS,
    DiscoverResourceRequest,
    build_resource_discovery,
    discovery_query,
    merge_live_docs,
    merge_live_videos,
)
from reflexlearn.learning.spaces import get_space_store

router = APIRouter()
_store = LearningAssetStore()
_study_store = ResourceStudyStore()


def get_asset_store() -> LearningAssetStore:
    return _store


def get_study_store() -> ResourceStudyStore:
    return _study_store


def set_asset_store_for_tests(store: LearningAssetStore) -> None:
    global _store
    _store = store


def reset_asset_store_for_tests() -> None:
    global _store, _study_store
    _store = LearningAssetStore()
    _study_store = ResourceStudyStore()


class CreateSpaceRequest(BaseModel):
    title: str
    course: str = ""


class UpdateSpaceRequest(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    course: str = Field(default="", max_length=200)


@router.post("/spaces")
async def create_space(req: CreateSpaceRequest, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    return await get_space_store().create_space(
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        title=req.title,
        course=req.course,
        pg_pool=pg_pool,
    )


@router.get("/spaces/{space_id}/detail")
async def get_space_detail(space_id: str, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    detail = await get_space_store().get_space_detail(space_id, pg_pool=pg_pool)
    if detail is None:
        return JSONResponse(status_code=404, content={"error": "space_not_found"})
    assert_object_access(
        user=user,
        owner_user_id=detail.user_id,
        tenant_id=detail.tenant_id,
        visibility="private",
    )
    return detail


@router.patch("/spaces/{space_id}")
async def update_space(
    space_id: str,
    req: UpdateSpaceRequest,
    user: CurrentUser = Depends(get_current_user),
):
    pg_pool = await safe_pg_pool()
    detail = await get_space_store().update_space(
        space_id,
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        title=req.title,
        course=req.course,
        pg_pool=pg_pool,
    )
    if detail is None:
        return JSONResponse(status_code=404, content={"error": "space_not_found"})
    return detail


@router.delete("/spaces/{space_id}")
async def delete_space(space_id: str, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    deleted = await get_space_store().delete_space(
        space_id,
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        pg_pool=pg_pool,
    )
    if not deleted:
        return JSONResponse(status_code=404, content={"error": "space_not_found"})
    return {"deleted": True, "space_id": space_id}


@router.get("/spaces")
async def list_spaces(user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    return await get_space_store().list_spaces(
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        pg_pool=pg_pool,
    )


@router.get("/spaces/{space_id}")
async def get_space(space_id: str, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    item = await get_asset_store().get_space(space_id, pg_pool=pg_pool)
    if item is None:
        return JSONResponse(status_code=404, content={"error": "space_not_found"})
    assert_object_access(
        user=user,
        owner_user_id=item.user_id,
        tenant_id=item.tenant_id,
        visibility="private",
    )
    return item


@router.get("/resources")
async def list_resources(user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    return await get_asset_store().list_resources(
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        pg_pool=pg_pool,
    )


@router.post("/resources/discover")
async def discover_resources(
    req: DiscoverResourceRequest,
    user: CurrentUser = Depends(get_current_user),
):
    result = build_resource_discovery(req)
    providers = req.providers or list(DEFAULT_PROVIDERS)
    settings = get_settings()
    if settings.enable_bilibili_search and "bilibili" in providers:
        videos = await get_bili_client().search_videos(discovery_query(req), limit=3)
        if videos:
            result = merge_live_videos(result, videos, req)
        else:
            result.degraded.append("bilibili:fallback_static")
    if settings.enable_mdn_search and "official_doc" in providers and is_web_topic(discovery_query(req)):
        docs = await get_mdn_client().search_docs(discovery_query(req), limit=2)
        if docs:
            result = merge_live_docs(result, docs, req)
        else:
            result.degraded.append("mdn:fallback_static")
    return result


class SaveResourceRequest(BaseModel):
    candidate_id: str = Field(min_length=1, max_length=160)
    type: str = Field(min_length=1, max_length=40)
    title: str = Field(min_length=1, max_length=200)
    provider: str = Field(default="", max_length=80)
    source_label: str = Field(default="", max_length=40)
    href: str = Field(default="", max_length=500)
    embed_url: str = Field(default="", max_length=500)
    usage_mode: str = Field(default="metadata_only", max_length=40)
    source_policy: str = Field(default="embed_or_redirect_only", max_length=40)
    estimated_minutes: int = Field(default=10, ge=1, le=600)
    reason: str = Field(default="", max_length=600)
    content_preview: str = Field(default="", max_length=600)
    concept: str = Field(default="", max_length=80)


@router.post("/resources/save")
async def save_resource(
    req: SaveResourceRequest,
    user: CurrentUser = Depends(get_current_user),
):
    pg_pool = await safe_pg_pool()
    item = LearningResource(
        resource_id=req.candidate_id,
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        type=req.type,
        title=req.title,
        content_preview=req.content_preview,
        visibility="private",
        provider=req.provider,
        source_label=req.source_label,
        href=req.href,
        embed_url=req.embed_url,
        usage_mode=req.usage_mode,
        source_policy=req.source_policy,
        estimated_minutes=req.estimated_minutes,
        reason=req.reason,
    )
    resource_id, duplicate = await get_asset_store().save_resource(
        item,
        candidate_id=req.candidate_id,
        content=req.content_preview or req.reason,
        concept=req.concept,
        pg_pool=pg_pool,
    )
    return {
        "resource_id": resource_id,
        "saved": True,
        "duplicate": duplicate,
        "degraded": [] if pg_pool is not None else ["pg:unavailable"],
    }


@router.get("/resources/{resource_id}")
async def get_resource(resource_id: str, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    item = await get_asset_store().get_resource(resource_id, pg_pool=pg_pool)
    if item is None:
        return JSONResponse(status_code=404, content={"error": "resource_not_found"})
    assert_object_access(
        user=user,
        owner_user_id=item.user_id,
        tenant_id=item.tenant_id,
        visibility=item.visibility,
    )
    return item


@router.get("/resources/{resource_id}/detail")
async def get_resource_detail(
    resource_id: str, user: CurrentUser = Depends(get_current_user)
):
    pg_pool = await safe_pg_pool()
    item = await get_asset_store().get_resource(resource_id, pg_pool=pg_pool)
    if item is None:
        return JSONResponse(status_code=404, content={"error": "resource_not_found"})
    assert_object_access(
        user=user,
        owner_user_id=item.user_id,
        tenant_id=item.tenant_id,
        visibility=item.visibility,
    )
    return await load_resource_detail(
        item,
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        pg_pool=pg_pool,
        study_store=get_study_store(),
    )


class UpdateStudyStatusRequest(BaseModel):
    status: StudyStatus


@router.patch("/resources/{resource_id}/status")
async def patch_resource_status(
    resource_id: str,
    req: UpdateStudyStatusRequest,
    user: CurrentUser = Depends(get_current_user),
):
    pg_pool = await safe_pg_pool()
    item = await get_asset_store().get_resource(resource_id, pg_pool=pg_pool)
    if item is None:
        return JSONResponse(status_code=404, content={"error": "resource_not_found"})
    # 学习状态归属本人：visibility 传 private 强制 owner 校验，公共资源也只能写自己的状态
    assert_object_access(
        user=user,
        owner_user_id=item.user_id,
        tenant_id=item.tenant_id,
        visibility="private",
    )
    return await update_study_status(
        resource_id,
        req.status,
        user_id=user.user_id,
        pg_pool=pg_pool,
        study_store=get_study_store(),
    )


@router.get("/knowledge/documents")
async def list_documents(user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    return await get_asset_store().list_documents(
        user_id=user.user_id,
        tenant_id=user.tenant_id,
        pg_pool=pg_pool,
    )


@router.get("/knowledge/documents/{doc_id}")
async def get_document(doc_id: str, user: CurrentUser = Depends(get_current_user)):
    pg_pool = await safe_pg_pool()
    item = await get_asset_store().get_document(doc_id, pg_pool=pg_pool)
    if item is None:
        return JSONResponse(status_code=404, content={"error": "document_not_found"})
    assert_object_access(
        user=user,
        owner_user_id=item.user_id,
        tenant_id=item.tenant_id,
        visibility=item.visibility,
    )
    return item
