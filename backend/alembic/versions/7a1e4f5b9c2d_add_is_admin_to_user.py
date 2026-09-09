"""Add is_admin to users

Revision ID: 7a1e4f5b9c2d
Revises: 4c91d2e8f0a3
Create Date: 2026-09-05 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7a1e4f5b9c2d'
down_revision: Union[str, Sequence[str], None] = '4c91d2e8f0a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Boolean default False so existing users stay non-admin. The
    # `is_admin=True` flag is meant to be flipped manually via SQL for the
    # one or two operator accounts that need /api/admin/*.
    op.add_column(
        'users',
        sa.Column('is_admin', sa.Boolean(), nullable=False, server_default=sa.text('false'))
    )


def downgrade() -> None:
    op.drop_column('users', 'is_admin')
