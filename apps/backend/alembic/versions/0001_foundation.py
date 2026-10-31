"""Establish migration history without introducing Task 02 domain tables.

Alembic manages its version table. Task 01 has no persistent business entity;
creating a fake invoice or health table would prematurely implement later tasks.
"""

revision = "0001_foundation"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
