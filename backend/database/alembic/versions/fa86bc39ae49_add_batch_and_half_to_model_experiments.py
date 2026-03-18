"""add_batch_and_half_to_model_experiments

Revision ID: fa86bc39ae49
Revises: 
Create Date: 2026-01-21 08:43:42.317949

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fa86bc39ae49'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
