"""initial schema: users, preferences, watchlists, analysis history, ML analysis

Revision ID: 0001
Revises:
Create Date: 2025-01-01 00:00:00
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(80), nullable=False),
        sa.Column("email", sa.String(254), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "user_preferences",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("default_range", sa.String(4), nullable=False),
        sa.Column("chart_type", sa.String(12), nullable=False),
        sa.Column("indicators", sa.JSON(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "watchlists",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "watchlist_stocks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("watchlist_id", sa.Integer(), sa.ForeignKey("watchlists.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(12), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("added_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("watchlist_id", "ticker", name="uq_watchlist_ticker"),
    )
    op.create_index("ix_watchlist_stocks_watchlist_id", "watchlist_stocks", ["watchlist_id"])

    op.create_table(
        "analysis_history",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(12), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_analysis_history_user_time", "analysis_history", ["user_id", "analyzed_at"])

    op.create_table(
        "ml_analysis",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(12), nullable=False),
        sa.Column("model_version", sa.String(80), nullable=False),
        sa.Column("regime", sa.String(16), nullable=False),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("volatility_regime", sa.String(16), nullable=False),
        sa.Column("anomaly_detected", sa.Integer(), nullable=False),
        sa.Column("holdout_accuracy", sa.Float(), nullable=True),
        sa.Column("baseline_accuracy", sa.Float(), nullable=True),
        sa.Column("data_source", sa.String(16), nullable=False),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_ml_analysis_user_time", "ml_analysis", ["user_id", "analyzed_at"])


def downgrade() -> None:
    op.drop_index("ix_ml_analysis_user_time", table_name="ml_analysis")
    op.drop_table("ml_analysis")
    op.drop_index("ix_analysis_history_user_time", table_name="analysis_history")
    op.drop_table("analysis_history")
    op.drop_index("ix_watchlist_stocks_watchlist_id", table_name="watchlist_stocks")
    op.drop_table("watchlist_stocks")
    op.drop_table("watchlists")
    op.drop_table("user_preferences")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
