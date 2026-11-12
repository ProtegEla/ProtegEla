from typing import Any

from pydantic import ValidationError

from src.modules.support_locations.schemas import SupportLocation


class OverpassAdapter:
    """Converte elementos da Overpass em locais de apoio do ProtegEla."""

    def to_support_locations(
        self,
        osm_elements: list[dict[str, Any]],
    ) -> list[SupportLocation]:
        support_locations: list[SupportLocation] = []

        for osm_element in osm_elements:
            support_location = self.to_support_location(osm_element)

            if support_location is not None:
                support_locations.append(support_location)

        return support_locations

    def to_support_location(
        self,
        osm_element: dict[str, Any],
    ) -> SupportLocation | None:
        element_type = osm_element.get("type")
        osm_id = osm_element.get("id")

        if element_type not in ("node", "way", "relation"):
            return None

        if type(osm_id) is not int or osm_id <= 0:
            return None

        if element_type == "node":
            coordinates = osm_element
        else:
            coordinates = osm_element.get("center")

        if not isinstance(coordinates, dict):
            return None

        name: str | None = None
        tags = osm_element.get("tags")

        if isinstance(tags, dict):
            possible_name = tags.get("name")
            if isinstance(possible_name, str):
                name = possible_name

        try:
            return SupportLocation(
                id=f"{element_type}/{osm_id}",
                name=name,
                latitude=coordinates.get("lat"),
                longitude=coordinates.get("lon"),
            )
        except ValidationError:
            return None