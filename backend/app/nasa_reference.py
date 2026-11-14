"""Public NASA references available without a historical dataset."""

from .schemas import ScientificReference


HRP_REFERENCES = (
    ScientificReference(
        source="NASA HRP", title="Human Spaceflight Hazards",
        url="https://www.nasa.gov/hrp/hazards/", type="research_reference",
    ),
    ScientificReference(
        source="NASA HRP", title="Risks of Human Spaceflight",
        url="https://www.nasa.gov/hrp/risks/", type="research_reference",
    ),
    ScientificReference(
        source="NASA HRP", title="Ongoing HRP Research",
        url="https://www.nasa.gov/hrp/ongoing-hrp-research/", type="research_reference",
    ),
)
