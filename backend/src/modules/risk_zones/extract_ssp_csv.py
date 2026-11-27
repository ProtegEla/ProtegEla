"""Extrai e normaliza ocorrências de planilhas XLSX da SSP-SP para CSV compatível com import_ssp.

Uso:
    python -m src.modules.risk_zones.extract_ssp_csv ../SPDadosCriminais_2026.xlsx -o ssp_sp_2026.csv
"""

from __future__ import annotations

import argparse
import csv
import io
import math
import unicodedata
import zipfile
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import date, datetime, timedelta
from pathlib import Path

from src.modules.risk_zones.service import RUBRICA_TO_CATEGORY

EXCEL_EPOCH = date(1899, 12, 30)

CSV_COLUMNS = [
    "NOME_DELEGACIA",
    "ANO_BO",
    "NUM_BO",
    "VERSAO",
    "RUBRICA",
    "CIDADE",
    "DATA_OCORRENCIA_BO",
    "LATITUDE",
    "LONGITUDE",
    "LOGRADOURO",
]

STREET_LOCAL_TYPES = {
    "VIA PUBLICA",
    "TERMINAL/ESTACAO",
    "ESTACIONAMENTO/GARAGEM",
    "AREA NAO OCUPADA",
    "COMERCIO E SERVICOS",
    "CENTRO COMERCIAL/EMPRESARIAL",
}

DEFAULT_RUBRICAS = set(RUBRICA_TO_CATEGORY.keys())


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(
        unicodedata.normalize("NFKD", str(value))
        .encode("ascii", "ignore")
        .decode()
        .upper()
        .split()
    )


def parse_excel_date(raw: str | None) -> str | None:
    if not raw:
        return None
    text = raw.strip()
    if not text or text.upper() == "NULL":
        return None
    # Serial numérico do Excel (ex: 46039)
    try:
        serial = float(text.replace(",", "."))
        if math.isfinite(serial) and 20000 <= serial <= 80000:
            return (EXCEL_EPOCH + timedelta(days=int(serial))).isoformat()
    except ValueError:
        pass
    # Formato ISO YYYY-MM-DD
    try:
        return date.fromisoformat(text[:10]).isoformat()
    except ValueError:
        pass
    # Formato brasileiro DD/MM/YYYY
    try:
        return datetime.strptime(text[:10], "%d/%m/%Y").date().isoformat()
    except ValueError:
        return None


def parse_coord(raw: str | None) -> float | None:
    if not raw:
        return None
    text = raw.strip().replace(",", ".")
    if not text or text.upper() == "NULL":
        return None
    try:
        val = float(text)
    except ValueError:
        return None
    if not math.isfinite(val) or val == 0:
        return None
    return val


def normalize_city(raw: str | None) -> str:
    norm = normalize_text(raw)
    if norm in {"S.PAULO", "S PAULO", "SAO PAULO"}:
        return "SAO PAULO"
    return norm


def _col_index_from_ref(ref: str) -> int:
    col = 0
    for ch in ref:
        if "A" <= ch <= "Z":
            col = col * 26 + (ord(ch) - ord("A") + 1)
        else:
            break
    return max(0, col - 1)


def _iter_xlsx_sheets(xlsx_path: Path):
    """Itera sobre abas (sheet_name, rows_as_dicts) usando apenas stdlib."""
    with zipfile.ZipFile(xlsx_path) as zf:
        wb_xml = ET.fromstring(zf.read("xl/workbook.xml"))
        rels_xml = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rel_map = {
            el.attrib["Id"]: el.attrib["Target"].lstrip("/")
            for el in rels_xml
            if "Id" in el.attrib and "Target" in el.attrib
        }

        strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            for _, elem in ET.iterparse(zf.open("xl/sharedStrings.xml"), events=("end",)):
                if elem.tag.endswith("}si") or elem.tag == "si":
                    strings.append(
                        "".join(
                            t.text or ""
                            for t in elem.iter()
                            if t.tag.endswith("}t") or t.tag == "t"
                        )
                    )
                    elem.clear()

        for sheet_el in wb_xml.iter():
            if not (sheet_el.tag.endswith("}sheet") or sheet_el.tag == "sheet"):
                continue
            name = sheet_el.attrib.get("name", "")
            rid = next(
                (v for k, v in sheet_el.attrib.items() if k.endswith("}id") or k == "r:id"),
                None,
            )
            if not rid or rid not in rel_map:
                continue
            target = rel_map[rid]
            if not target.startswith("xl/"):
                target = f"xl/{target}"
            if target not in zf.namelist():
                continue

            yield name, _iter_sheet_rows(zf.open(target), strings)


def _iter_sheet_rows(stream, strings: list[str]):
    header: list[str] | None = None
    for _, elem in ET.iterparse(stream, events=("end",)):
        if not (elem.tag.endswith("}row") or elem.tag == "row"):
            continue

        row_values: list[str] = []
        for c in elem:
            ref = c.attrib.get("r", "")
            idx = _col_index_from_ref(ref) if ref else len(row_values)
            while len(row_values) < idx:
                row_values.append("")

            cell_type = c.attrib.get("t", "")
            if cell_type == "inlineStr":
                val = "".join(
                    t.text or ""
                    for t in c.iter()
                    if t.tag.endswith("}t") or t.tag == "t"
                )
            else:
                v_el = next((ch for ch in c if ch.tag.endswith("}v") or ch.tag == "v"), None)
                val = v_el.text if v_el is not None and v_el.text is not None else ""
                if cell_type == "s" and val:
                    val = strings[int(val)]
            row_values.append(val)

        elem.clear()
        if not any(row_values):
            continue

        if header is None:
            if "NUM_BO" in row_values and "LATITUDE" in row_values:
                header = [col.strip() for col in row_values]
            continue

        yield {
            header[i]: (row_values[i] if i < len(row_values) else "")
            for i in range(len(header))
        }


def extract_ssp_xlsx_to_csv(
    xlsx_path: Path,
    output_csv: Path,
    *,
    city: str = "SAO PAULO",
    include_all_locations: bool = False,
    allowed_rubricas: set[str] | None = DEFAULT_RUBRICAS,
    since: str | None = None,
) -> Counter:
    """Lê todas as abas de ocorrências do XLSX e grava CSV UTF-8 pronto para import_ssp."""
    counts: Counter = Counter()
    target_city = normalize_text(city)
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()

    for _sheet_name, rows in _iter_xlsx_sheets(xlsx_path):
        for row in rows:
            counts["total_rows"] += 1

            row_city = normalize_city(row.get("CIDADE") or row.get("NOME_MUNICIPIO"))
            if target_city and row_city != target_city:
                counts["skipped_other_city"] += 1
                continue

            logradouro = (row.get("LOGRADOURO") or "").strip()
            if "VEDACAO DA DIVULGACAO" in normalize_text(logradouro):
                counts["skipped_protected_location"] += 1
                continue

            if not include_all_locations:
                tipo_local = normalize_text(row.get("DESCR_TIPOLOCAL"))
                if tipo_local and tipo_local not in STREET_LOCAL_TYPES:
                    counts["skipped_non_street_local"] += 1
                    continue

            rubrica_raw = (row.get("RUBRICA") or "").strip()
            if allowed_rubricas is not None and normalize_text(rubrica_raw) not in allowed_rubricas:
                counts["skipped_other_rubrica"] += 1
                continue

            lat = parse_coord(row.get("LATITUDE"))
            lon = parse_coord(row.get("LONGITUDE"))
            if lat is None or lon is None or not (-90 <= lat <= 90 and -180 <= lon <= 180):
                counts["skipped_invalid_coords"] += 1
                continue

            iso_date = parse_excel_date(row.get("DATA_OCORRENCIA_BO"))
            if not iso_date:
                counts["skipped_invalid_date"] += 1
                continue
            if since and iso_date < since:
                counts["skipped_before_since"] += 1
                continue

            delegacia = (row.get("NOME_DELEGACIA") or "").strip()
            ano_bo = (row.get("ANO_BO") or "").strip()
            num_bo = (row.get("NUM_BO") or "").strip()
            versao_raw = (row.get("VERSAO") or "1").strip()
            versao = versao_raw if versao_raw.isdigit() and int(versao_raw) >= 1 else "1"

            if not (delegacia and ano_bo and num_bo):
                counts["skipped_missing_identity"] += 1
                continue

            writer.writerow(
                {
                    "NOME_DELEGACIA": delegacia,
                    "ANO_BO": ano_bo,
                    "NUM_BO": num_bo,
                    "VERSAO": versao,
                    "RUBRICA": rubrica_raw,
                    "CIDADE": row_city,
                    "DATA_OCORRENCIA_BO": iso_date,
                    "LATITUDE": f"{lat:.6f}",
                    "LONGITUDE": f"{lon:.6f}",
                    "LOGRADOURO": logradouro,
                }
            )
            counts["exported"] += 1

    output_csv.parent.mkdir(parents=True, exist_ok=True)
    output_csv.write_bytes(buffer.getvalue().encode("utf-8"))
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Extrai e filtra ocorrências de XLSX SSP-SP para CSV normalizado."
    )
    parser.add_argument("xlsx", type=Path, help="Caminho para o arquivo .xlsx da SSP-SP")
    parser.add_argument("-o", "--output", type=Path, required=True, help="CSV de saída")
    parser.add_argument(
        "--city",
        default="SAO PAULO",
        help="Município alvo (padrão: SAO PAULO / RF05)",
    )
    parser.add_argument(
        "--include-all-locations",
        action="store_true",
        help="Não filtrar DESCR_TIPOLOCAL (inclui residências)",
    )
    parser.add_argument(
        "--all-rubricas",
        action="store_true",
        help="Exporta todas as rubricas em vez de filtrar apenas as aprovadas",
    )
    parser.add_argument(
        "--since",
        default=None,
        help="Data mínima ISO (YYYY-MM-DD) para exportar apenas ocorrências recentes",
    )
    args = parser.parse_args()

    counts = extract_ssp_xlsx_to_csv(
        args.xlsx,
        args.output,
        city=args.city,
        include_all_locations=args.include_all_locations,
        allowed_rubricas=None if args.all_rubricas else DEFAULT_RUBRICAS,
        since=args.since,
    )
    for key, val in sorted(counts.items()):
        print(f"{key}: {val}")


if __name__ == "__main__":
    main()
