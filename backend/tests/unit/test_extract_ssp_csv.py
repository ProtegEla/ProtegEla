import csv
import io
import zipfile
from pathlib import Path
from shapely.geometry import box

from src.modules.risk_zones.extract_ssp_csv import (
    extract_ssp_xlsx_to_csv,
    parse_excel_date,
)
from src.modules.risk_zones.service import parse_csv


def _build_minimal_xlsx(path: Path, headers: list[str], rows: list[list[str]]) -> None:
    def _row_xml(idx: int, values: list[str]) -> str:
        cells = "".join(
            f'<c t="inlineStr"><is><t>{v}</t></is></c>' for v in values
        )
        return f'<row r="{idx}">{cells}</row>'

    sheet_rows = [_row_xml(1, headers)] + [
        _row_xml(i + 2, r) for i, r in enumerate(rows)
    ]
    sheet_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(sheet_rows)}</sheetData>'
        "</worksheet>"
    )
    workbook_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
        '<sheets><sheet name="JAN-JUN_2026" sheetId="1" r:id="rId1"/></sheets>'
        "</workbook>"
    )
    rels_xml = (
        '<?xml version="1.0" encoding="UTF-8"?>'
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
        '<Relationship Id="rId1" '
        'Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" '
        'Target="worksheets/sheet1.xml"/>'
        "</Relationships>"
    )
    with zipfile.ZipFile(path, "w") as zf:
        zf.writestr("xl/workbook.xml", workbook_xml)
        zf.writestr("xl/_rels/workbook.xml.rels", rels_xml)
        zf.writestr("xl/worksheets/sheet1.xml", sheet_xml)


def test_parse_excel_date_converts_serial_and_iso():
    assert parse_excel_date("46039") == "2026-01-17"
    assert parse_excel_date("2026-03-10") == "2026-03-10"
    assert parse_excel_date("10/03/2026") == "2026-03-10"
    assert parse_excel_date("NULL") is None


def test_extract_ssp_xlsx_filters_street_and_city_and_matches_import_ssp(tmp_path: Path):
    xlsx_path = tmp_path / "ssp.xlsx"
    csv_path = tmp_path / "out.csv"

    headers = [
        "NOME_DELEGACIA",
        "NOME_MUNICIPIO",
        "NUM_BO",
        "ANO_BO",
        "DATA_OCORRENCIA_BO",
        "DESCR_TIPOLOCAL",
        "LOGRADOURO",
        "LATITUDE",
        "LONGITUDE",
        "RUBRICA",
    ]
    rows = [
        # Válido: São Paulo + Via Pública + Furto + coordenadas válidas
        [
            "01º D.P. SE",
            "S.PAULO",
            "BO001",
            "2026",
            "46039",
            "Via Pública",
            "RUA DIREITA",
            "-23,550520",
            "-46,633308",
            "Furto (art. 155)",
        ],
        # Deve ser excluído: Residência
        [
            "01º D.P. SE",
            "S.PAULO",
            "BO002",
            "2026",
            "46039",
            "Residência",
            "RUA A",
            "-23.550520",
            "-46.633308",
            "Furto (art. 155)",
        ],
        # Deve ser excluído: Outro município
        [
            "01º D.P. CAMPINAS",
            "CAMPINAS",
            "BO003",
            "2026",
            "46039",
            "Via Pública",
            "AV BRASIL",
            "-22.90",
            "-47.06",
            "Furto (art. 155)",
        ],
        # Deve ser excluído: Coordenada zerada
        [
            "01º D.P. SE",
            "S.PAULO",
            "BO004",
            "2026",
            "46039",
            "Via Pública",
            "VEDAÇÃO DA DIVULGAÇÃO DOS DADOS RELATIVOS",
            "0",
            "0",
            "Furto (art. 155)",
        ],
    ]
    _build_minimal_xlsx(xlsx_path, headers, rows)

    counts = extract_ssp_xlsx_to_csv(xlsx_path, csv_path)
    assert counts["exported"] == 1
    assert counts["skipped_non_street_local"] == 1
    assert counts["skipped_other_city"] == 1
    assert counts["skipped_protected_location"] == 1

    # Garante compatibilidade direta com parse_csv() usado pelo import_ssp.py
    sp_box = box(-46.85, -23.85, -46.35, -23.35)
    candidates, import_counts = parse_csv(csv_path.read_bytes(), sp_box)
    assert len(candidates) == 1
    assert import_counts["accepted"] == 1

    parsed = list(csv.DictReader(io.StringIO(csv_path.read_text(encoding="utf-8"))))
    assert parsed[0]["CIDADE"] == "SAO PAULO"
    assert parsed[0]["DATA_OCORRENCIA_BO"] == "2026-01-17"


def test_extract_ssp_xlsx_since_filter(tmp_path: Path):
    xlsx_path = tmp_path / "ssp_since.xlsx"
    csv_path = tmp_path / "out_since.csv"
    headers = [
        "NOME_DELEGACIA",
        "NOME_MUNICIPIO",
        "NUM_BO",
        "ANO_BO",
        "DATA_OCORRENCIA_BO",
        "DESCR_TIPOLOCAL",
        "LOGRADOURO",
        "LATITUDE",
        "LONGITUDE",
        "RUBRICA",
    ]
    rows = [
        ["01º D.P. SE", "S.PAULO", "BO1", "2026", "2026-01-10", "Via Pública", "RUA A", "-23.55", "-46.63", "Furto (art. 155)"],
        ["01º D.P. SE", "S.PAULO", "BO2", "2026", "2026-09-10", "Via Pública", "RUA B", "-23.55", "-46.63", "Roubo (art. 157)"],
    ]
    _build_minimal_xlsx(xlsx_path, headers, rows)

    counts = extract_ssp_xlsx_to_csv(xlsx_path, csv_path, since="2026-08-01")
    assert counts["exported"] == 1
    assert counts["skipped_before_since"] == 1

