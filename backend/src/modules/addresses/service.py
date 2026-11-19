from collections import deque
from time import monotonic

from src.core.exceptions import AppException
from src.modules.addresses.clients import OpenRouteServiceGeocodingClient
from src.modules.addresses.schemas import AddressSuggestion


class AddressService:
    def __init__(
        self, client: OpenRouteServiceGeocodingClient, requests_per_minute: int = 60
    ):
        self.client = client
        self.requests_per_minute = requests_per_minute
        self.requests: deque[float] = deque()

    async def suggest(self, text: str, limit: int) -> list[AddressSuggestion]:
        now = monotonic()
        while self.requests and self.requests[0] <= now - 60:
            self.requests.popleft()
        if len(self.requests) >= self.requests_per_minute:
            raise AppException(
                "Muitas consultas. Tente novamente mais tarde.",
                code="RATE_LIMIT_EXCEEDED",
                status_code=429,
            )
        self.requests.append(now)
        suggestions = await self.client.autocomplete(text.strip())
        seen: set[str] = set()
        results: list[AddressSuggestion] = []
        for suggestion in suggestions:
            if suggestion.id not in seen:
                seen.add(suggestion.id)
                results.append(suggestion)
            if len(results) == limit:
                break
        return results
