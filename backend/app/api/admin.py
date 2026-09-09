import uuid
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.models import AdminAuditLog, CostLog, Generation, Project, User
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """
    Authorization gate for admin-only endpoints.
    Enforces that current_user.is_admin is True.
    """
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required.",
        )
    return current_user


def _draft_preview(gen: Generation) -> str:
    """Return the first 120 characters of the active draft for preview."""
    drafts = {1: gen.draft_1, 2: gen.draft_2, 3: gen.draft_3}
    active = gen.active_draft_index or 1
    text = drafts.get(active) or gen.draft_1 or ""
    return text[:120].replace("\n", " ").strip()


@router.get("/stats")
async def get_admin_stats(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Aggregate usage stats across the platform from real SQL counts."""
    now = datetime.now(timezone.utc)
    t_24h = now - timedelta(hours=24)
    t_7d = now - timedelta(days=7)
    t_30d = now - timedelta(days=30)

    # 1. Total users and signups in time windows
    user_stmt = select(
        func.count(User.id).label("total_users"),
        func.count(User.id).filter(User.created_at >= t_24h).label("signups_24h"),
        func.count(User.id).filter(User.created_at >= t_7d).label("signups_7d"),
        func.count(User.id).filter(User.created_at >= t_30d).label("signups_30d"),
    )
    user_res = await session.execute(user_stmt)
    u_row = user_res.first()

    # 2. Total generations and activity in time windows
    gen_stmt = select(
        func.count(Generation.id).label("total_generations"),
        func.count(Generation.id).filter(Generation.created_at >= t_24h).label("generations_24h"),
        func.count(Generation.id).filter(Generation.created_at >= t_7d).label("generations_7d"),
        func.count(Generation.id).filter(Generation.created_at >= t_30d).label("generations_30d"),
    )
    gen_res = await session.execute(gen_stmt)
    g_row = gen_res.first()

    # 3. Platform breakdown (LinkedIn vs. X)
    platform_stmt = (
        select(Project.platform, func.count(Generation.id).label("count"))
        .join(Generation, Generation.project_id == Project.id)
        .group_by(Project.platform)
    )
    platform_res = await session.execute(platform_stmt)
    platform_breakdown = {row.platform: row.count for row in platform_res}

    return {
        "users": {
            "total": u_row.total_users or 0,
            "signups_last_24h": u_row.signups_24h or 0,
            "signups_last_7d": u_row.signups_7d or 0,
            "signups_last_30d": u_row.signups_30d or 0,
        },
        "generations": {
            "total": g_row.total_generations or 0,
            "generations_last_24h": g_row.generations_24h or 0,
            "generations_last_7d": g_row.generations_7d or 0,
            "generations_last_30d": g_row.generations_30d or 0,
            "platform_breakdown": platform_breakdown,
        },
    }


@router.get("/users")
async def get_admin_users(
    q: str | None = None,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    List platform users with aggregate activity metrics.
    NEVER includes password hashes or personal profile context.
    """
    # Subquery for user generation metrics
    gen_subquery = (
        select(
            Project.user_id.label("user_id"),
            func.count(Generation.id).label("generation_count"),
            func.max(Generation.created_at).label("last_active_at"),
        )
        .join(Generation, Generation.project_id == Project.id)
        .group_by(Project.user_id)
        .subquery()
    )

    query = (
        select(
            User.id,
            User.username,
            User.is_admin,
            User.created_at,
            func.coalesce(gen_subquery.c.generation_count, 0).label("generation_count"),
            func.coalesce(gen_subquery.c.last_active_at, User.created_at).label("last_active_at"),
        )
        .outerjoin(gen_subquery, User.id == gen_subquery.c.user_id)
    )

    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.where(User.username.ilike(search_pattern))

    count_stmt = select(func.count(User.id))
    if q and q.strip():
        count_stmt = count_stmt.where(User.username.ilike(search_pattern))
    total_res = await session.execute(count_stmt)
    total = total_res.scalar() or 0

    query = query.order_by(User.created_at.desc()).limit(limit).offset(offset)
    result = await session.execute(query)
    rows = result.fetchall()

    users_list = [
        {
            "id": str(row.id),
            "username": row.username,
            "is_admin": bool(row.is_admin),
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "generation_count": int(row.generation_count),
            "last_active_at": row.last_active_at.isoformat() if row.last_active_at else None,
        }
        for row in rows
    ]

    return {
        "items": users_list,
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/users/{user_id}/generations")
async def get_user_generations(
    user_id: str,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """
    Inspect a specific user's generated posts.
    Reuses the standardized history shape.
    Writes an immutable audit log entry documenting this administrative inspection.
    """
    try:
        target_uuid = uuid.UUID(user_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid user ID format.")

    # 1. Verify target user exists
    target_user_res = await session.execute(select(User).where(User.id == target_uuid))
    target_user = target_user_res.scalars().first()
    if not target_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    # 2. Record immutable audit log entry
    audit_entry = AdminAuditLog(
        admin_user_id=current_user.id,
        action="viewed_user_generations",
        target_user_id=target_uuid,
    )
    session.add(audit_entry)
    await session.commit()

    # 3. Query user generations
    count_stmt = (
        select(func.count(Generation.id))
        .join(Project, Generation.project_id == Project.id)
        .where(Project.user_id == target_uuid)
    )
    total_res = await session.execute(count_stmt)
    total = total_res.scalar() or 0

    stmt = (
        select(Generation, Project.platform)
        .join(Project, Generation.project_id == Project.id)
        .where(Project.user_id == target_uuid)
        .order_by(Generation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    res = await session.execute(stmt)
    rows = res.fetchall()

    items = [
        {
            "generation_id": str(gen.id),
            "project_id": str(gen.project_id),
            "topic": gen.topic,
            "raw_thoughts": gen.raw_thoughts,
            "platform": platform,
            "status": gen.status,
            "active_draft_index": gen.active_draft_index or 1,
            "preview": _draft_preview(gen),
            "draft_1": gen.draft_1,
            "draft_2": gen.draft_2,
            "draft_3": gen.draft_3,
            "created_at": gen.created_at.isoformat() if gen.created_at else None,
            "updated_at": gen.updated_at.isoformat() if gen.updated_at else None,
        }
        for gen, platform in rows
    ]

    return {
        "items": items,
        "total": total,
        "limit": limit,
        "offset": offset,
        "user": {
            "id": str(target_user.id),
            "username": target_user.username,
        },
    }


@router.get("/cost-summary")
async def get_cost_summary(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    """Aggregate token costs across model operations."""
    stmt = select(
        func.sum(CostLog.prompt_tokens).label("total_prompt_tokens"),
        func.sum(CostLog.completion_tokens).label("total_completion_tokens"),
        func.sum(CostLog.estimated_cost_usd).label("total_cost_usd"),
    )
    result = await session.execute(stmt)
    row = result.first()

    op_stmt = select(
        CostLog.operation,
        func.sum(CostLog.estimated_cost_usd).label("cost"),
    ).group_by(CostLog.operation)
    op_result = await session.execute(op_stmt)

    breakdown = {op_row.operation: op_row.cost for op_row in op_result}

    return {
        "total_prompt_tokens": row.total_prompt_tokens or 0,
        "total_completion_tokens": row.total_completion_tokens or 0,
        "total_cost_usd": row.total_cost_usd or 0.0,
        "breakdown": breakdown,
    }
