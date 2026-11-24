"""merge migration heads

Revision ID: 5a904edfe58c
Revises: 0007_create_safety_guides, 0008_risk_geography_indexes
Create Date: 2026-11-16 22:04:10.429086

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
import geoalchemy2


# revision identifiers, used by Alembic.
revision: str = '5a904edfe58c'
down_revision: Union[str, None] = ('0007_create_safety_guides', '0008_risk_geography_indexes')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
