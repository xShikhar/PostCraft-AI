from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from app.core.database import get_db
from app.models import CostLog, User
from app.api.auth import get_current_user

router = APIRouter(prefix="/api/admin", tags=["admin"])

@router.get("/cost-summary")
async def get_cost_summary(
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, verify current_user.is_admin.
    # For now, we just require authentication.
    
    # Aggregate total costs
    stmt = select(
        func.sum(CostLog.prompt_tokens).label("total_prompt_tokens"),
        func.sum(CostLog.completion_tokens).label("total_completion_tokens"),
        func.sum(CostLog.estimated_cost_usd).label("total_cost_usd")
    )
    result = await session.execute(stmt)
    row = result.first()
    
    # Aggregate by operation
    op_stmt = select(
        CostLog.operation,
        func.sum(CostLog.estimated_cost_usd).label("cost")
    ).group_by(CostLog.operation)
    op_result = await session.execute(op_stmt)
    
    breakdown = {}
    for op_row in op_result:
        breakdown[op_row.operation] = op_row.cost

    return {
        "total_prompt_tokens": row.total_prompt_tokens or 0,
        "total_completion_tokens": row.total_completion_tokens or 0,
        "total_cost_usd": row.total_cost_usd or 0.0,
        "breakdown": breakdown
    }
