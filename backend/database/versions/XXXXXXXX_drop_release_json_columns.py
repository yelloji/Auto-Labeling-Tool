from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "XXXXXXXX"
down_revision = "<previous_revision_id>"  # auto-filled by Alembic
branch_labels = None
depends_on = None


def upgrade() -> None:
    # --- up ---
    op.drop_column("releases", "classes_json", if_exists=True)
    op.drop_column("releases", "shapes_json", if_exists=True)


def downgrade() -> None:
    # --- down (rollback) ---
    op.add_column("releases", sa.JSON(name="classes_json"))
    op.add_column("releases", sa.JSON(name="shapes_json"))