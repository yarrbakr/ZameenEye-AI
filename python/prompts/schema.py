from pydantic import BaseModel, Field
from typing import Literal, Optional

# ---- Output schema: what YOUR pipeline produces ----
class AgriAdvisory(BaseModel):
    language: Literal["ur", "hi", "sw", "ta"]
    location_name: str
    hazard_type: Literal["fire", "flood", "storm", "other", "none"]
    risk_level: Literal["low", "moderate", "high", "critical", "clear"]
    advisory_text: str = Field(..., max_length=600)
    recommended_action: str
    confidence: Literal["low", "medium", "high"]
    source_timestamp_utc: str

# ---- Input schema: what Kai's backend sends YOU ----
class Land(BaseModel):
    id: str
    label: str
    country: Literal["Pakistan", "India", "Kenya"]

class Owner(BaseModel):
    name: str
    phone_number: str
    role: Literal["farmer", "agency_admin"]
    preferred_language: Literal["urdu", "hindi", "swahili", "tamil"]

class IntersectingEvent(BaseModel):
    source: str
    raw_payload: dict

class HazardPayload(BaseModel):
    checked_at: str
    land: Land
    owner: Owner
    has_active_hazard: bool
    intersecting_events: list[IntersectingEvent] = []

# Maps Kai's full language names to your short codes
LANGUAGE_CODE_MAP = {
    "urdu": "ur",
    "hindi": "hi",
    "swahili": "sw",
    "tamil": "ta",
}