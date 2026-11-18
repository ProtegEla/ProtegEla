"""CSV normalizado SSP: qualidade, versões e privacidade."""

import csv
import io
from shapely.geometry import box
import pytest
from src.modules.risk_zones.service import HEADERS, parse_csv

BOUNDARY = box(-46.8, -23.8, -46.4, -23.3)


def row(**changes):
    return {
        "NOME_DELEGACIA": "Delegacia teste",
        "ANO_BO": "2026",
        "NUM_BO": "TESTE",
        "VERSAO": "1",
        "RUBRICA": "Furto (art. 155)",
        "CIDADE": "São Paulo",
        "DATA_OCORRENCIA_BO": "2026-01-01",
        "LATITUDE": "-23.55",
        "LONGITUDE": "-46.63",
        "LOGRADOURO": "",
        **changes,
    }


def content(*rows):
    stream = io.StringIO()
    writer = csv.DictWriter(stream, fieldnames=sorted(HEADERS))
    writer.writeheader()
    writer.writerows(rows)
    return stream.getvalue().encode()


def test_dedup_latest_version_and_normalization():
    candidates, counts = parse_csv(
        content(row(), row(), row(VERSAO="2", LATITUDE="-23.56")), BOUNDARY
    )
    assert len(candidates) == 1
    candidate = next(iter(candidates.values()))
    assert candidate.version == 2 and candidate.latitude == -23.56
    assert counts == {"rows": 3, "accepted": 1}


@pytest.mark.parametrize(
    "changes,reason",
    [
        ({"LATITUDE": ""}, "invalid_date_or_location"),
        ({"LATITUDE": "NaN"}, "invalid_location"),
        ({"LONGITUDE": "0"}, "invalid_location"),
        ({"LATITUDE": "91"}, "invalid_location"),
        ({"DATA_OCORRENCIA_BO": "01/01/2026"}, "invalid_date_or_location"),
        ({"LONGITUDE": "-47"}, "outside_boundary"),
        ({"CIDADE": "Santos"}, "outside_city"),
        (
            {"LOGRADOURO": "VEDAÇÃO DA DIVULGAÇÃO DOS DADOS RELATIVOS"},
            "protected_location",
        ),
        ({"RUBRICA": "Roubo (art. 157)"}, "unsupported_nature"),
    ],
)
def test_rejected_rows(changes, reason):
    candidates, counts = parse_csv(content(row(**changes)), BOUNDARY)
    item = next(iter(candidates.values()))
    assert item.rejection == reason
    assert counts[reason] == 1


def test_latest_conflict_not_arbitrarily_selected():
    candidates, _ = parse_csv(content(row(), row(LATITUDE="-23.56")), BOUNDARY)
    assert next(iter(candidates.values())).rejection == "conflicting_latest_version"


def test_nature_changes_in_latest_version():
    candidates, _ = parse_csv(
        content(row(), row(VERSAO="2", RUBRICA="Perda/Extravio")), BOUNDARY
    )
    assert next(iter(candidates.values())).rejection == "unsupported_nature"


@pytest.mark.parametrize("changes", [{"VERSAO": ""}, {"NUM_BO": ""}, {"VERSAO": "0"}])
def test_invalid_identity_cancels_load(changes):
    with pytest.raises(ValueError):
        parse_csv(content(row(**changes)), BOUNDARY)


def test_missing_headers():
    with pytest.raises(ValueError):
        parse_csv(b"LATITUDE,LONGITUDE\n-23,-46", BOUNDARY)
