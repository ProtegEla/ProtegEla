from typing import Annotated

from pydantic import BaseModel, Field, StringConstraints

SearchText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)
]


class AddressSuggestion(BaseModel):
    id: str = Field(min_length=1)
    label: str = Field(min_length=1)
    latitude: float = Field(ge=-90, le=90, allow_inf_nan=False)
    longitude: float = Field(ge=-180, le=180, allow_inf_nan=False)


class AddressSuggestionsResponse(BaseModel):
    data: list[AddressSuggestion]
