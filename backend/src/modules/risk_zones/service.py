"""Importação SSP e agrupamento espacial; sem responsabilidades HTTP."""

import csv
import hashlib
import io
import math
import unicodedata
from collections import Counter
from dataclasses import dataclass
from datetime import date
from uuid import NAMESPACE_URL, UUID, uuid4, uuid5

from geoalchemy2.shape import from_shape
from shapely.geometry import Point
from shapely.geometry.base import BaseGeometry
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.modules.risk_zones.models import SSPSafetyRecord

HEADERS = {
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
}


def normalized(value: str) -> str:
    return " ".join(
        unicodedata.normalize("NFKD", value)
        .encode("ascii", "ignore")
        .decode()
        .upper()
        .split()
    )


@dataclass(frozen=True)
class Candidate:
    version: int
    latitude: float | None = None
    longitude: float | None = None
    incident_date: date | None = None
    rejection: str | None = None


def parse_csv(
    content: bytes, boundary: BaseGeometry
) -> tuple[dict[str, Candidate], Counter]:
    """CSV UTF-8, datas ISO e coordenadas decimais WGS84 já normalizadas."""
    if (
        boundary.geom_type not in {"Polygon", "MultiPolygon"}
        or boundary.is_empty
        or not boundary.is_valid
    ):
        raise ValueError(
            "Limite municipal deve ser Polygon/MultiPolygon válido em WGS84."
        )
    west, south, east, north = boundary.bounds
    if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
        raise ValueError("Limite municipal fora de WGS84.")
    reader = csv.DictReader(io.StringIO(content.decode("utf-8-sig")))
    if (
        not reader.fieldnames
        or len(reader.fieldnames) != len(set(reader.fieldnames))
        or not HEADERS <= set(reader.fieldnames)
    ):
        raise ValueError("Cabeçalhos SSP obrigatórios ausentes ou duplicados.")
    groups: dict[str, list[dict]] = {}
    counts = Counter()
    for row in reader:
        counts["rows"] += 1
        if None in row or any(row.get(h) is None for h in HEADERS):
            raise ValueError("CSV com linha incompleta ou colunas excedentes.")
        identity = [normalized(row[h]) for h in ("NOME_DELEGACIA", "ANO_BO", "NUM_BO")]
        if not all(identity) or not row["VERSAO"].isdigit() or int(row["VERSAO"]) < 1:
            # Sem versão confiável não é seguro selecionar outra linha do boletim.
            raise ValueError("Identificação ou versão inválida; carga cancelada.")
        key = hashlib.sha256("\x1f".join(identity).encode()).hexdigest()
        groups.setdefault(key, []).append(row)
    candidates = {}
    for key, rows in groups.items():
        version = max(int(r["VERSAO"]) for r in rows)
        latest = [r for r in rows if int(r["VERSAO"]) == version]
        values = set()
        for row in latest:
            reason = None
            lat = lon = day = None
            try:
                lat, lon = float(row["LATITUDE"]), float(row["LONGITUDE"])
                day = date.fromisoformat(row["DATA_OCORRENCIA_BO"])
                if day.isoformat() != row["DATA_OCORRENCIA_BO"]:
                    raise ValueError("Data fora do formato ISO.")
                if (
                    not math.isfinite(lat)
                    or not math.isfinite(lon)
                    or not (-90 <= lat <= 90 and -180 <= lon <= 180)
                    or lat == 0
                    or lon == 0
                ):
                    reason = "invalid_location"
                elif not boundary.covers(Point(lon, lat)):
                    reason = "outside_boundary"
            except (ValueError, TypeError):
                reason = "invalid_date_or_location"
            if normalized(row["CIDADE"]) != "SAO PAULO":
                reason = "outside_city"
            if "VEDACAO DA DIVULGACAO" in normalized(row["LOGRADOURO"]):
                reason = "protected_location"
            if reason:
                values.add((None, None, None, reason))
            else:
                values.add((lat, lon, day, None))
        if len(values) != 1:
            candidate = Candidate(version, rejection="conflicting_latest_version")
        elif not any(normalized(r["RUBRICA"]) == "FURTO (ART. 155)" for r in latest):
            candidate = Candidate(version, rejection="unsupported_nature")
        else:
            lat, lon, day, reason = values.pop()
            candidate = Candidate(version, lat, lon, day, reason)
        candidates[key] = candidate
        counts[candidate.rejection or "accepted"] += 1
    return candidates, counts


async def import_ssp(
    session: AsyncSession,
    content: bytes,
    *,
    boundary: BaseGeometry,
    source_url: str,
    source_period: str,
) -> dict[str, int]:
    if (
        not source_url.startswith("https://www.ssp.sp.gov.br/")
        or len(source_url) > 2048
        or not 1 <= len(source_period.strip()) <= 50
    ):
        raise ValueError("URL SSP ou período inválido.")
    candidates, counts = parse_csv(content, boundary)
    digest = hashlib.sha256(content).hexdigest()
    try:
        # Serializa cargas concorrentes; não há consulta externa na transação.
        await session.execute(text("SELECT pg_advisory_xact_lock(73320603)"))
        for key, item in candidates.items():
            record = await session.scalar(
                select(SSPSafetyRecord)
                .where(SSPSafetyRecord.source_key == key)
                .execution_options(populate_existing=True)
            )
            if record and record.source_version > item.version:
                counts["ignored_older"] += 1
                continue
            if record is None:
                record = SSPSafetyRecord(id=uuid4(), source_key=key)
                session.add(record)
            record.source_version = item.version
            record.location = (
                from_shape(Point(item.longitude, item.latitude), srid=4326)
                if item.rejection is None
                else None
            )
            record.incident_date = (
                item.incident_date if item.rejection is None else None
            )
            record.is_active = item.rejection is None
            record.source_url = source_url
            record.source_period = source_period.strip()
            record.file_sha256 = digest
            record.imported_at = func.clock_timestamp()
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    return dict(counts)


# Uma consulta mantém membros, vizinhança e geometrias no mesmo snapshot.
# Geography mede em metros no elipsoide, com tolerância numérica de 0,1 micrômetro no limite de 20 m.
_GROUP_QUERY = text(
    """
WITH incidents AS MATERIALIZED (
    SELECT 'app:' || id::text AS key, id, 'app'::text AS source,
           category::text AS category, description, incident_date, location
    FROM reports WHERE NOT is_hidden
    UNION ALL
    SELECT 'ssp:' || id::text, id, 'ssp', category, NULL::text,
           incident_date, location
    FROM ssp_safety_records WHERE is_active
)
SELECT i.key, i.id, i.source, i.category, i.description, i.incident_date,
       ST_AsGeoJSON(i.location, 15)::json AS location,
       ST_AsGeoJSON(ST_Buffer(i.location::geography, 10)::geometry, 15)::json AS buffer,
       ARRAY(
           SELECT 'app:' || n.id::text FROM reports n
           WHERE NOT n.is_hidden AND ('app' <> i.source OR n.id <> i.id)
           AND ST_DWithin(n.location::geography, i.location::geography, 20.0000001)
           UNION ALL
           SELECT 'ssp:' || n.id::text FROM ssp_safety_records n
           WHERE n.is_active AND ('ssp' <> i.source OR n.id <> i.id)
           AND ST_DWithin(n.location::geography, i.location::geography, 20.0000001)
       ) AS neighbors
FROM incidents i ORDER BY i.key
"""
)


@dataclass(frozen=True, kw_only=True)
class ZoneIncident:
    id: UUID
    source: str
    category: str
    description: str | None
    incident_date: date
    location: dict


@dataclass(frozen=True, kw_only=True)
class RiskZone:
    id: UUID
    geometry: dict
    marker_location: dict
    categories: tuple[str, ...]
    sources: tuple[str, ...]
    incidents: tuple[ZoneIncident, ...]


def group_incidents(rows) -> list[RiskZone]:
    """Componentes conexos; vizinhança métrica calculada exclusivamente no PostGIS."""
    from shapely.geometry import mapping, shape
    from shapely.ops import unary_union

    parents = {row["key"]: row["key"] for row in rows}

    def root(key):
        while parents[key] != key:
            parents[key] = parents[parents[key]]
            key = parents[key]
        return key

    for row in rows:
        for neighbor in row["neighbors"]:
            left, right = root(row["key"]), root(neighbor)
            if left != right:
                parents[max(left, right)] = min(left, right)
    groups = {}
    for row in rows:
        groups.setdefault(root(row["key"]), []).append(row)
    result = []
    for members in groups.values():
        members.sort(key=lambda row: row["key"])
        # UUID v5 identifica a composição, não uma zona persistida.
        zone_id = uuid5(
            NAMESPACE_URL,
            "protegela:risk-zone:" + "|".join(row["key"] for row in members),
        )
        geometry = (
            shape(members[0]["location"])
            if len(members) == 1
            else unary_union([shape(row["buffer"]) for row in members])
        )
        incidents = tuple(
            ZoneIncident(
                **{
                    key: row[key]
                    for key in (
                        "id",
                        "source",
                        "category",
                        "description",
                        "incident_date",
                        "location",
                    )
                }
            )
            for row in sorted(
                members,
                key=lambda row: (row["incident_date"], row["id"].int, row["source"]),
                reverse=True,
            )
        )
        result.append(
            RiskZone(
                id=zone_id,
                geometry=mapping(geometry),
                marker_location=mapping(geometry.representative_point()),
                categories=tuple(sorted({row["category"] for row in members})),
                sources=tuple(sorted({row["source"] for row in members})),
                incidents=incidents,
            )
        )
    return sorted(result, key=lambda zone: zone.id.int)


class RiskZoneService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def group(self) -> list[RiskZone]:
        """Agrupa todos os membros visíveis antes de qualquer recorte de mapa."""
        result = await self.session.execute(
            _GROUP_QUERY.execution_options(autoflush=False)
        )
        return group_incidents(result.mappings().all())

    async def list(self, bbox: str) -> list[RiskZone]:
        from shapely.geometry import box, shape
        from src.core.exceptions import BusinessRuleException

        bounds = parse_bbox(bbox)
        viewport = box(*bounds)
        zones = [
            zone
            for zone in await self.group()
            if shape(zone.geometry).intersects(viewport)
        ]
        if len(zones) > 500:
            raise BusinessRuleException(
                "Mais de 500 zonas. Aproxime o mapa.", code="VALIDATION_ERROR"
            )
        return zones

    async def incidents(
        self, zone_id: UUID, *, page: int = 1, page_size: int = 20
    ) -> tuple[tuple[ZoneIncident, ...], int]:
        from src.core.exceptions import BusinessRuleException, EntityNotFoundException

        if (
            type(page) is not int
            or type(page_size) is not int
            or page < 1
            or not 1 <= page_size <= 100
        ):
            raise BusinessRuleException("Paginação inválida.", code="VALIDATION_ERROR")
        for zone in await self.group():
            if zone.id == zone_id:
                start = (page - 1) * page_size
                return zone.incidents[start : start + page_size], len(zone.incidents)
        raise EntityNotFoundException("Zona não encontrada. Atualize o mapa.")


def parse_bbox(value: str) -> tuple[float, float, float, float]:
    """Área do retângulo na esfera de raio médio terrestre, em metros quadrados."""
    from src.core.exceptions import BusinessRuleException

    try:
        west, south, east, north = map(float, value.split(","))
        if not all(math.isfinite(v) for v in (west, south, east, north)):
            raise ValueError
        if not (-180 <= west < east <= 180 and -90 <= south < north <= 90):
            raise ValueError
        area = (
            6371008.8**2
            * math.radians(east - west)
            * (math.sin(math.radians(north)) - math.sin(math.radians(south)))
        )
        if area > 25_000_000:
            raise ValueError
        return west, south, east, north
    except (ValueError, AttributeError, TypeError):
        raise BusinessRuleException(
            "bbox inválida ou maior que 25 km². Aproxime o mapa.",
            code="VALIDATION_ERROR",
        ) from None
