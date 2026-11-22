"""Candidatas para pedestres e comparação de exposição aos riscos mapeados."""

import asyncio
import math
from collections import deque
from itertools import pairwise, product
from time import monotonic

from src.core.exceptions import (
    AppException,
    BusinessRuleException,
    ExternalServiceException,
)
from src.modules.routes.clients import OpenRouteServiceClient
from src.modules.routes.schemas import (
    CalculatedRoutes,
    RouteCalculate,
    RouteComparison,
    RouteGeometry,
    WalkingRoute,
)


def direct_distance(a, b) -> float:
    lat1, lat2 = math.radians(a.latitude), math.radians(b.latitude)
    delta_lat = lat2 - lat1
    delta_lon = math.radians(b.longitude - a.longitude)
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    )
    return 6371008.8 * 2 * math.asin(math.sqrt(min(1, value)))


class RouteService:
    def __init__(self, client: OpenRouteServiceClient, requests_per_minute: int = 10):
        self.client = client
        self.requests_per_minute = requests_per_minute
        self.requests: deque[float] = deque()

    async def calculate(
        self, request: RouteCalculate, evaluator=None
    ) -> CalculatedRoutes:
        points = request.points()
        if sum(direct_distance(a, b) for a, b in pairwise(points)) > 50000:
            raise BusinessRuleException(
                "O itinerário excede 50 km em linha reta.", code="VALIDATION_ERROR"
            )
        now = monotonic()
        while self.requests and self.requests[0] <= now - 60:
            self.requests.popleft()
        if len(self.requests) >= self.requests_per_minute:
            raise AppException(
                "Muitas consultas de rotas.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )
        self.requests.append(now)
        try:
            async with asyncio.timeout(self.client.timeout_seconds):
                results = [
                    await self.client.alternatives(a, b) for a, b in pairwise(points)
                ]
        except TimeoutError:
            raise ExternalServiceException(
                "Tempo limite para cálculo da rota."
            ) from None

        routes = {}
        # Até 3^4 combinações, sem chamadas adicionais ao provedor.
        for combination in product(*(result.features for result in results)):
            coordinates = []
            legs = []
            for feature in combination:
                current = feature.geometry.coordinates
                if coordinates and coordinates[-1] != current[0]:
                    break  # Não inventar ligação entre pontos ajustados diferentes.
                offset = len(coordinates) - 1 if coordinates else 0
                leg = feature.leg()
                for step in leg.steps:
                    step.way_points = tuple(index + offset for index in step.way_points)
                coordinates.extend(current[1:] if coordinates else current)
                legs.append(leg)
            else:
                distance = sum(leg.distance_m for leg in legs)
                if distance > 100000:
                    continue
                route = WalkingRoute(
                    geometry=RouteGeometry(type="LineString", coordinates=coordinates),
                    distance_m=distance,
                    duration_s=sum(leg.duration_s for leg in legs),
                    legs=legs,
                )
                key = tuple(coordinates)
                if key not in routes or route.duration_s < routes[key].duration_s:
                    routes[key] = route
        if not routes:
            raise ExternalServiceException(
                "O provedor não retornou um itinerário contínuo dentro dos limites."
            )
        candidates = sorted(
            routes.values(), key=lambda r: (r.duration_s, r.geometry.coordinates)
        )
        if evaluator is not None:
            risks = await evaluator.evaluate(candidates)
            for route, risk in zip(candidates, risks, strict=True):
                route.risk = risk
        fastest = candidates[0]
        comparison = RouteComparison(fastest_route_id=fastest.id)
        lowest = None
        if all(route.risk.status == "evaluated" for route in candidates):
            lowest = min(
                candidates,
                key=lambda r: (
                    r.risk.exposure_score,
                    r.duration_s,
                    r.geometry.coordinates,
                ),
            )
            if lowest.risk.exposure_score < fastest.risk.exposure_score:
                comparison = RouteComparison(
                    fastest_route_id=fastest.id,
                    lower_risk_route_id=lowest.id,
                    extra_duration_percent=100
                    * (lowest.duration_s / fastest.duration_s - 1),
                    exceeds_30_percent=lowest.duration_s > 1.30 * fastest.duration_s,
                    status="lower_risk_available",
                )
            else:
                lowest = None
                comparison.status = "no_lower_risk_alternative"
        elif all(route.risk.status == "no_mapped_data" for route in candidates):
            comparison.status = "no_mapped_data"
        selected = candidates[:3]
        if lowest is not None and lowest not in selected:
            selected[-1] = lowest
            selected.sort(key=lambda r: (r.duration_s, r.geometry.coordinates))
        return CalculatedRoutes(
            routes=selected,
            comparison=comparison,
            attribution="; ".join(
                dict.fromkeys(result.metadata.attribution for result in results)
            ),
        )


class RouteRiskEvaluator:
    """Avaliação conservadora; nunca interpreta falha como ausência de risco."""

    def __init__(self, risk_service, road_client):
        self.risk_service = risk_service
        self.road_client = road_client

    async def evaluate(self, routes):
        from sqlalchemy.exc import SQLAlchemyError

        from src.modules.routes.schemas import RouteRisk

        try:
            coordinates = [
                coordinate
                for route in routes
                for coordinate in route.geometry.coordinates
            ]
            west = min(p[0] for p in coordinates) - 0.0006
            east = max(p[0] for p in coordinates) + 0.0006
            south = min(p[1] for p in coordinates) - 0.0005
            north = max(p[1] for p in coordinates) + 0.0005
            # Recorte local e de tamanho limitado para geometria métrica e Overpass.
            if not (-47.5 <= west < east <= -45.5 and -24.5 <= south < north <= -22.5):
                raise ValueError("Fora da região suportada para avaliação.")
            if (east - west) * 102000 * (north - south) * 111000 > 100000000:
                raise ValueError("Área de análise superior a 100 km².")
            bounds = (west, south, east, north)

            def inside(geometry):
                x, y = geometry["coordinates"]
                return west <= x <= east and south <= y <= north

            async with asyncio.timeout(5):
                rows, incidents = await self.risk_service.snapshot()
                if not any(inside(row["location"]) for row in rows):
                    return [RouteRisk(status="no_mapped_data") for _ in routes]
                incidents = [
                    incident for incident in incidents if inside(incident["geometry"])
                ]
                roads = await self.road_client.roads(bounds)
                scores = await self.risk_service.exposures(routes, roads, incidents)
                if len(scores) != len(routes):
                    raise ValueError("Avaliação incompleta.")
                return [
                    RouteRisk(status="evaluated", exposure_score=score)
                    for score in scores
                ]
        except (SQLAlchemyError, ExternalServiceException, TimeoutError, ValueError, Exception):
            return [RouteRisk() for _ in routes]
