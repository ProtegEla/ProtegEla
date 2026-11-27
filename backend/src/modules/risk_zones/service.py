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
from sqlalchemy.dialects.postgresql import insert as pg_insert
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


RUBRICA_TO_CATEGORY: dict[str, str] = {
    "FURTO (ART. 155)": "Furto",
    "ROUBO (ART. 157)": "Roubo",
    "LESAO CORPORAL (ART. 129)": "Violência",
    "HOMICIDIO (ART. 121)": "Violência",
    "FEMINICIDIO": "Violência",
    "EXTORSAO MEDIANTE SEQUESTRO (ART. 159)": "Violência",
    "ESTUPRO - ART. 213": "Assédio",
    "ESTUPRO DE VULNERAVEL (ART.217-A)": "Assédio",
    "IMPORTUNACAO SEXUAL (ART. 215-A)": "Assédio",
}


def resolve_ssp_category(rubrica: str) -> str | None:
    return RUBRICA_TO_CATEGORY.get(normalized(rubrica))


@dataclass(frozen=True)
class Candidate:
    version: int
    latitude: float | None = None
    longitude: float | None = None
    incident_date: date | None = None
    rejection: str | None = None
    category: str = "Furto"


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
        matched_categories = [
            cat for r in latest if (cat := resolve_ssp_category(r["RUBRICA"])) is not None
        ]
        if len(values) != 1:
            candidate = Candidate(version, rejection="conflicting_latest_version")
        elif not matched_categories:
            candidate = Candidate(version, rejection="unsupported_nature")
        else:
            lat, lon, day, reason = values.pop()
            candidate = Candidate(
                version, lat, lon, day, reason, category=matched_categories[0]
            )
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
    period = source_period.strip()
    batch_size = 2000
    items = list(candidates.items())

    try:
        # Serializa cargas concorrentes; não há consulta externa na transação.
        await session.execute(text("SELECT pg_advisory_xact_lock(73320603)"))

        for offset in range(0, len(items), batch_size):
            chunk = items[offset : offset + batch_size]
            keys = [k for k, _ in chunk]

            existing_rows = await session.execute(
                select(SSPSafetyRecord.source_key, SSPSafetyRecord.source_version).where(
                    SSPSafetyRecord.source_key.in_(keys)
                )
            )
            existing_versions = dict(existing_rows.all())

            upsert_values: list[dict] = []
            for key, item in chunk:
                prev_version = existing_versions.get(key)
                if prev_version is not None and prev_version > item.version:
                    counts["ignored_older"] += 1
                    continue

                is_valid = item.rejection is None
                upsert_values.append(
                    {
                        "id": uuid4(),
                        "source_key": key,
                        "source_version": item.version,
                        "category": item.category,
                        "location": (
                            from_shape(Point(item.longitude, item.latitude), srid=4326)
                            if is_valid
                            else None
                        ),
                        "incident_date": item.incident_date if is_valid else None,
                        "is_active": is_valid,
                        "source_url": source_url,
                        "source_period": period,
                        "file_sha256": digest,
                    }
                )

            if upsert_values:
                stmt = pg_insert(SSPSafetyRecord).values(upsert_values)
                stmt = stmt.on_conflict_do_update(
                    index_elements=["source_key"],
                    set_={
                        "source_version": stmt.excluded.source_version,
                        "category": stmt.excluded.category,
                        "location": stmt.excluded.location,
                        "incident_date": stmt.excluded.incident_date,
                        "is_active": stmt.excluded.is_active,
                        "source_url": stmt.excluded.source_url,
                        "source_period": stmt.excluded.source_period,
                        "file_sha256": stmt.excluded.file_sha256,
                        "imported_at": func.clock_timestamp(),
                    },
                )
                await session.execute(stmt)

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


_GROUP_BBOX_QUERY = text(
    """
WITH viewport AS MATERIALIZED (
    SELECT ST_MakeEnvelope(:west, :south, :east, :north, 4326)::geography AS geog
),
incidents AS MATERIALIZED (
    SELECT 'app:' || id::text AS key, id, 'app'::text AS source,
           category::text AS category, description, incident_date, location
    FROM reports, viewport
    WHERE NOT is_hidden AND ST_DWithin(location::geography, viewport.geog, 100.0)
    UNION ALL
    SELECT 'ssp:' || id::text, id, 'ssp', category, NULL::text,
           incident_date, location
    FROM ssp_safety_records, viewport
    WHERE is_active AND ST_DWithin(location::geography, viewport.geog, 100.0)
)
SELECT i.key, i.id, i.source, i.category, i.description, i.incident_date,
       ST_AsGeoJSON(i.location, 15)::json AS location,
       ST_AsGeoJSON(ST_Buffer(i.location::geography, 10)::geometry, 15)::json AS buffer,
       ARRAY(
           SELECT n.key FROM incidents n
           WHERE n.key <> i.key
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


_GROUP_BBOX_QUERY = text(
    """
WITH viewport AS MATERIALIZED (
    SELECT ST_MakeEnvelope(:west, :south, :east, :north, 4326)::geography AS geog
),
incidents AS MATERIALIZED (
    SELECT 'app:' || id::text AS key, id, 'app'::text AS source,
           category::text AS category, description, incident_date, location
    FROM reports, viewport
    WHERE NOT is_hidden AND ST_DWithin(location::geography, viewport.geog, 100.0)
    UNION ALL
    SELECT 'ssp:' || id::text, id, 'ssp', category, NULL::text,
           incident_date, location
    FROM ssp_safety_records, viewport
    WHERE is_active AND ST_DWithin(location::geography, viewport.geog, 100.0)
)
SELECT i.key, i.id, i.source, i.category, i.description, i.incident_date,
       ST_AsGeoJSON(i.location, 15)::json AS location,
       ST_AsGeoJSON(ST_Buffer(i.location::geography, 10)::geometry, 15)::json AS buffer,
       ARRAY(
           SELECT n.key FROM incidents n
           WHERE n.key <> i.key
           AND ST_DWithin(n.location::geography, i.location::geography, 20.0000001)
       ) AS neighbors
FROM incidents i ORDER BY i.key
"""
)


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

    async def group(
        self, bounds: tuple[float, float, float, float] | None = None
    ) -> list[RiskZone]:
        """Agrupa membros visíveis; quando bounds é informado, filtra via índice GiST antes do agrupamento."""
        if bounds is not None:
            west, south, east, north = bounds
            result = await self.session.execute(
                _GROUP_BBOX_QUERY.execution_options(autoflush=False),
                {"west": west, "south": south, "east": east, "north": north},
            )
        else:
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
            for zone in await self.group(bounds)
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


# Regras específicas da comparação incremental de rotas; não alteram o mapa RF06.
def calendar_months_before(day, months):
    from calendar import monthrange

    year, month = divmod(day.year * 12 + day.month - 1 - months, 12)
    month += 1
    return day.replace(
        year=year, month=month, day=min(day.day, monthrange(year, month)[1])
    )


def routing_weights(rows, today):
    """Pontuação dos grupos com uma referência temporal comum, sem níveis de segurança."""
    cutoff = calendar_months_before(today, 6)
    annual = calendar_months_before(today, 12)
    valid = [row for row in rows if row["incident_date"] <= today]
    keys = {row["key"] for row in valid}
    valid = [
        {**row, "neighbors": [key for key in row["neighbors"] if key in keys]}
        for row in valid
    ]
    by_key = {row["key"]: row for row in valid}
    weighted = []
    for group in group_incidents(valid):
        members = [
            by_key[f"{incident.source}:{incident.id}"] for incident in group.incidents
        ]
        eligible = any(
            row["source"] == "ssp" or row["confirmations"] >= 3 for row in members
        )
        if not eligible:
            continue
        activities = [
            row["last_activity"]
            for row in members
            if row["last_activity"] is not None and row["last_activity"] <= today
        ]
        recent = bool(activities) and max(activities) >= cutoff
        score = sum(
            (
                (2 if row["incident_date"] >= annual else 0.5)
                if row["source"] == "ssp"
                else (1 + row["confirmations"]) * (1 if recent else 0.5)
            )
            for row in members
        )
        for row in members:
            weighted.append(
                {"group_id": str(group.id), "score": score, "geometry": row["location"]}
            )
    return weighted


class RoutingRiskService:
    """Snapshot dos incidentes e correspondência métrica entre OSM e ORS."""

    def __init__(self, session):
        self.session = session

    async def snapshot(self):
        from datetime import datetime
        from zoneinfo import ZoneInfo

        today = datetime.now(ZoneInfo("America/Sao_Paulo")).date()
        # Um único statement garante a mesma visão de relatos, moderação e votos.
        query = text(
            """
            WITH grouped AS ("""
            + _GROUP_QUERY.text
            + """ )
            SELECT g.*, votes.confirmations,
                greatest((r.created_at AT TIME ZONE 'America/Sao_Paulo')::date,
                         votes.last_activity) AS last_activity
            FROM grouped g
            LEFT JOIN reports r ON g.source = 'app' AND r.id = g.id
            LEFT JOIN LATERAL (
                SELECT count(DISTINCT user_id) FILTER (
                    WHERE kind = 'confirmation'
                    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date >= :cutoff
                    AND (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= :today
                ) AS confirmations,
                max((created_at AT TIME ZONE 'America/Sao_Paulo')::date) FILTER (
                    WHERE (created_at AT TIME ZONE 'America/Sao_Paulo')::date <= :today
                ) AS last_activity
                FROM report_interactions WHERE report_id = r.id
            ) votes ON true
            ORDER BY g.key LIMIT 10001
        """
        )
        result = await self.session.execute(
            query, {"cutoff": calendar_months_before(today, 6), "today": today}
        )
        rows = result.mappings().all()
        if len(rows) > 10000:
            raise ValueError("Limite de incidentes para avaliação excedido.")
        rows = [row for row in rows if row["incident_date"] <= today]
        return rows, routing_weights(rows, today)

    async def exposures(self, routes, roads, incidents):
        import json

        # Projeção métrica local; o chamador restringe a análise à região de SP.
        query = text("""
        WITH roads AS MATERIALIZED (
            SELECT value->>'id' AS id, (value->>'ground')::boolean AS ground,
                ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON((value->'geometry')::text),4326),31983) AS geom
            FROM jsonb_array_elements(CAST(:roads AS jsonb))
        ), incidents AS (
            SELECT value->>'group_id' AS group_id, (value->>'score')::float AS score,
                ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON((value->'geometry')::text),4326),31983) AS geom
            FROM jsonb_array_elements(CAST(:incidents AS jsonb))
        ), nearest AS (
            SELECT i.*, n.id, n.ground, n.distance,
                (SELECT min(ST_Distance(i.geom, r.geom)) FROM roads r WHERE r.id <> n.id) AS second
            FROM incidents i LEFT JOIN LATERAL (
                SELECT id, ground, ST_Distance(i.geom, geom) AS distance
                FROM roads ORDER BY ST_Distance(i.geom, geom), id LIMIT 1
            ) n ON true
        ), weights AS (
            SELECT id, sum(score) AS score FROM (
                SELECT DISTINCT id, group_id, score FROM nearest
            ) groups GROUP BY id
        ), pieces AS (
            SELECT route_index, (ST_DumpSegments(geom)).geom AS geom
            FROM (
                SELECT ordinality - 1 AS route_index,
                    ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON(value::text),4326),31983) AS geom
                FROM jsonb_array_elements(CAST(:routes AS jsonb)) WITH ORDINALITY
            ) route_geometries
        ), matched AS (
            SELECT p.*, m.id, m.matches, m.ground FROM pieces p
            LEFT JOIN LATERAL (
                SELECT min(id) AS id, count(*) AS matches, bool_and(ground) AS ground
                FROM roads r WHERE ST_Covers(ST_Buffer(r.geom,3),p.geom)
            ) m ON true
        )
        SELECT route_index,
            bool_and(matches = 1 AND ground) AS matched,
            sum(ST_Length(ST_Transform(m.geom,4326)::geography) * coalesce(w.score,0)) AS exposure,
            (SELECT bool_and(id IS NOT NULL AND ground AND distance <= 20
                AND (second IS NULL OR second - distance > 1)) FROM nearest) AS incidents_matched
        FROM matched m LEFT JOIN weights w ON w.id = m.id
        GROUP BY route_index ORDER BY route_index
        """)
        result = await self.session.execute(
            query,
            {
                "roads": json.dumps(roads),
                "incidents": json.dumps(incidents),
                "routes": json.dumps([route.geometry.model_dump() for route in routes]),
            },
        )
        rows = result.mappings().all()
        if len(rows) != len(routes) or any(
            not row["matched"] or row["incidents_matched"] is False for row in rows
        ):
            raise ValueError("Correspondência de vias incompleta ou ambígua.")
        return [row["exposure"] for row in rows]
