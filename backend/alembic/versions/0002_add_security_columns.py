"""Add security columns to users table

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-10
"""
from alembic import op
import sqlalchemy as sa

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("users", sa.Column("failed_login_attempts", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("users", sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True))
    op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))
    op.add_column("users", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()))

    # Tighten existing columns (add length constraints where missing)
    op.alter_column("users", "username", type_=sa.String(50), existing_nullable=False)
    op.alter_column("users", "email", type_=sa.String(255), existing_nullable=False)
    op.alter_column("users", "hashed_password", type_=sa.String(255), existing_nullable=False)
    op.alter_column("users", "role", type_=sa.String(50), existing_nullable=False, server_default="staff")


def downgrade() -> None:
    op.drop_column("users", "updated_at")
    op.drop_column("users", "created_at")
    op.drop_column("users", "locked_until")
    op.drop_column("users", "failed_login_attempts")
    op.drop_column("users", "is_superuser")
