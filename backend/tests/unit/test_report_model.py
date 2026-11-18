"""Verifica a conversão de categorias/períodos no limite da persistência."""

import pytest
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import InstrumentedAttribute
from src.modules.reports.models import (
    IncidentPeriod,
    Report,
    ReportCategory,
    ReportInteraction,
    ReportInteractionKind,
)


@pytest.mark.parametrize(
    "column, value, expected",
    [
        (Report.category, ReportCategory.ASSEDIO, "Assédio"),
        (Report.category, ReportCategory.VIOLENCIA, "Violência"),
        (Report.category, ReportCategory.FURTO, "Furto"),
        (Report.category, ReportCategory.MA_ILUMINACAO, "Má iluminação"),
        (Report.incident_period, IncidentPeriod.MADRUGADA, "madrugada"),
        (Report.incident_period, IncidentPeriod.MANHA, "manha"),
        (Report.incident_period, IncidentPeriod.TARDE, "tarde"),
        (Report.incident_period, IncidentPeriod.NOITE, "noite"),
        (ReportInteraction.kind, ReportInteractionKind.CONFIRMATION, "confirmation"),
        (ReportInteraction.kind, ReportInteractionKind.ABUSE, "abuse"),
    ],
)
def test_enum_persistence_round_trip(
    column: InstrumentedAttribute, value: str, expected: str
) -> None:
    dialect = postgresql.dialect()
    bind = column.type.bind_processor(dialect)
    result = column.type.result_processor(dialect, None)

    assert bind(value) == expected
    assert result(expected) is value


@pytest.mark.parametrize(
    "column, value",
    [
        (Report.category, "outra"),
        (Report.category, "ASSEDIO"),
        (Report.incident_period, "MANHA"),
        (Report.incident_period, "desconhecido"),
        (ReportInteraction.kind, "CONFIRMATION"),
        (ReportInteraction.kind, "outro"),
    ],
)
def test_persistence_rejects_unknown_enum_values(
    column: InstrumentedAttribute, value: str
) -> None:
    bind = column.type.bind_processor(postgresql.dialect())
    with pytest.raises(LookupError):
        bind(value)
