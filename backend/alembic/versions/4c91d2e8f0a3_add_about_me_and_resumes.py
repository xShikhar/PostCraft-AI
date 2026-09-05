"""Add about_me to User and create user_resumes table

Revision ID: 4c91d2e8f0a3
Revises: 3451f9589925
Create Date: 2026-09-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4c91d2e8f0a3'
down_revision: Union[str, Sequence[str], None] = '3451f9589925'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add about_me column to users table
    op.add_column('users', sa.Column('about_me', sa.Text(), nullable=True))

    # Create user_resumes table for resume storage
    op.create_table(
        'user_resumes',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('user_id', sa.Uuid(), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('raw_text', sa.Text(), nullable=False),
        sa.Column('structured_summary', sa.Text(), nullable=True),  # JSON string: {role, industry, expertise_areas, experience_level}
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', name='uq_user_resume_one_per_user'),
    )


def downgrade() -> None:
    op.drop_table('user_resumes')
    op.drop_column('users', 'about_me')
