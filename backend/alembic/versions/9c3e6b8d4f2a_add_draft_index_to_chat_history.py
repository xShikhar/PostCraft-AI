"""Add draft_index to chat_history

Revision ID: 9c3e6b8d4f2a
Revises: 8b2e5a7c3d1f
Create Date: 2026-09-11 16:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c3e6b8d4f2a'
down_revision: Union[str, Sequence[str], None] = '8b2e5a7c3d1f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('chat_history', sa.Column('draft_index', sa.Integer(), nullable=True, server_default='1'))


def downgrade() -> None:
    op.drop_column('chat_history', 'draft_index')
