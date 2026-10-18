"""Persist generation evidence, consent, private style notes and erasure jobs.

Revision ID: a2d4e6f8b0c1
Revises: 9c3e6b8d4f2a
"""
from alembic import op
import sqlalchemy as sa

revision = "a2d4e6f8b0c1"
down_revision = "9c3e6b8d4f2a"
branch_labels = None
depends_on = None


def upgrade():
    for col in (sa.Column("writing_style", sa.Text()), sa.Column("terms_version", sa.String(30)),
                sa.Column("terms_accepted_at", sa.DateTime(timezone=True))):
        op.add_column("users", col)
    for col in (sa.Column("context_snapshot", sa.Text()), sa.Column("original_drafts", sa.JSON()),
                sa.Column("research_data", sa.JSON()), sa.Column("quality_data", sa.JSON())):
        op.add_column("generations", col)
    with op.batch_alter_table("cost_logs") as batch:
        batch.add_column(sa.Column("user_id", sa.Uuid(), nullable=True))
        batch.add_column(sa.Column("model_name", sa.String(100), nullable=True))
        batch.create_foreign_key("fk_cost_user", "users", ["user_id"], ["id"], ondelete="CASCADE")
    duplicates = op.get_bind().execute(sa.text("SELECT lower(username) FROM users GROUP BY lower(username) HAVING count(*) > 1")).first()
    if duplicates:
        raise RuntimeError("Resolve case-insensitive duplicate usernames before migrating")
    op.execute("CREATE UNIQUE INDEX ix_users_username_normalized ON users (lower(username))")
    op.execute("DELETE FROM research_cache")  # Discard legacy cache entries without provenance.
    # Keep actor-independent records after account deletion (existing names vary).
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        for fk in sa.inspect(bind).get_foreign_keys("admin_audit_logs"):
            if fk["constrained_columns"] == ["admin_user_id"]:
                op.drop_constraint(fk["name"], "admin_audit_logs", type_="foreignkey")
        op.alter_column("admin_audit_logs", "admin_user_id", nullable=True)
        op.create_foreign_key("fk_audit_actor", "admin_audit_logs", "users", ["admin_user_id"], ["id"], ondelete="SET NULL")
    else:
        with op.batch_alter_table("admin_audit_logs", naming_convention={"fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s"}) as batch:
            batch.drop_constraint("fk_admin_audit_logs_admin_user_id_users", type_="foreignkey")
            batch.alter_column("admin_user_id", nullable=True)
            batch.create_foreign_key("fk_audit_actor", "users", ["admin_user_id"], ["id"], ondelete="SET NULL")
    op.create_table("vector_deletion_jobs", sa.Column("user_id", sa.Uuid(), primary_key=True),
                    sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                    sa.Column("completed_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_table("vector_deletion_jobs")
    with op.batch_alter_table("cost_logs") as batch:
        batch.drop_constraint("fk_cost_user", type_="foreignkey")
        batch.drop_column("user_id")
        batch.drop_column("model_name")
    op.drop_index("ix_users_username_normalized", table_name="users")
    for name in ("quality_data", "research_data", "original_drafts", "context_snapshot"):
        op.drop_column("generations", name)
    for name in ("terms_accepted_at", "terms_version", "writing_style"):
        op.drop_column("users", name)
    # Actor nullability is intentionally retained to avoid destroying audit records.
