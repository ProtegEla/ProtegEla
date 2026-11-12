import pytest

from src.modules.support_locations.adapters import OverpassAdapter


@pytest.mark.parametrize(
    ("element", "expected_id", "expected_latitude", "expected_longitude"),
    [
        (
            {
                "type": "node",
                "id": 123,
                "lat": -23.55,
                "lon": -46.63,
                "tags": {"name": "Delegacia Central"},
            },
            "node/123",
            -23.55,
            -46.63,
        ),
        (
            {
                "type": "way",
                "id": 456,
                "center": {"lat": -23.56, "lon": -46.64},
                "tags": {"name": "Delegacia do Bairro"},
            },
            "way/456",
            -23.56,
            -46.64,
        ),
        (
            {
                "type": "relation",
                "id": 789,
                "center": {"lat": -23.57, "lon": -46.65},
                "tags": {},
            },
            "relation/789",
            -23.57,
            -46.65,
        ),
    ],
)
def test_converts_overpass_elements_to_support_locations(
    element: dict,
    expected_id: str,
    expected_latitude: float,
    expected_longitude: float,
) -> None:
    location = OverpassAdapter().to_support_location(element)

    assert location is not None
    assert location.id == expected_id
    assert location.latitude == expected_latitude
    assert location.longitude == expected_longitude


def test_uses_none_when_element_has_no_name() -> None:
    element = {
        "type": "node",
        "id": 123,
        "lat": -23.55,
        "lon": -46.63,
        "tags": {"amenity": "police"},
    }

    location = OverpassAdapter().to_support_location(element)

    assert location is not None
    assert location.name is None


@pytest.mark.parametrize(
    "element",
    [
        {"type": "area", "id": 123, "lat": -23.55, "lon": -46.63},
        {"type": "node", "id": -1, "lat": -23.55, "lon": -46.63},
        {"type": "node", "id": 123, "lat": 95, "lon": -46.63},
        {"type": "way", "id": 123, "tags": {"name": "Sem centro"}},
    ],
)
def test_ignores_invalid_overpass_elements(element: dict) -> None:
    assert OverpassAdapter().to_support_location(element) is None


def test_converts_list_and_skips_invalid_elements() -> None:
    elements = [
        {"type": "node", "id": 1, "lat": -23.55, "lon": -46.63},
        {"type": "area", "id": 2, "lat": -23.55, "lon": -46.63},
    ]

    locations = OverpassAdapter().to_support_locations(elements)

    assert [location.id for location in locations] == ["node/1"]
