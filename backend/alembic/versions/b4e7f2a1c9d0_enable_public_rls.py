"""Enable row-level security on application tables exposed through Supabase.

The application talks to PostgreSQL through its trusted FastAPI server. It does
not use the Supabase Data API from the browser, so no public policies are
needed: enabling RLS with no policies denies anon/authenticated table access by
default while the database owner/service role used by the backend continues to
operate. Policies can be added later if a direct client integration is
introduced.
"""

from alembic import op


revision = "b4e7f2a1c9d0"
down_revision = "a2d4e6f8b0c1"
branch_labels = None
depends_on = None


TABLES = (
    "users",
    "projects",
    "generations",
    "style_profiles",
    "chat_history",
    "preferences",
    "research_cache",
    "cost_logs",
    "user_resumes",
    "admin_audit_logs",
    "vector_deletion_jobs",
)


def upgrade() -> None:
    # SQLite is used by the disposable test fixtures and has no RLS feature.
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in TABLES:
        op.execute(f"ALTER TABLE public.{table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    if op.get_bind().dialect.name != "postgresql":
        return
    for table in reversed(TABLES):
        op.execute(f"ALTER TABLE public.{table} DISABLE ROW LEVEL SECURITY")
