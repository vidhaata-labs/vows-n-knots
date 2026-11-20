"""Sample wedding brief used by the legacy app's "Load sample brief" button and the CLI."""

from __future__ import annotations

from datetime import date, timedelta
from typing import Any


def sample_form_values() -> dict[str, Any]:
    return {
        "couple_name": "Amira and Noah",
        "wedding_location": "Chicago, Illinois",
        "wedding_date": date.today() + timedelta(days=240),
        "guest_count": 120,
        "currency": "USD",
        "budget_range": (35000, 65000),
        "ceremony_type": "Ceremony and reception",
        "wedding_styles": ["Modern", "Romantic", "Cultural fusion"],
        "planning_priorities": ["Venue shortlist", "Vendor research", "Budget allocation", "Timeline"],
        "tone": "Elegant and practical",
        "must_haves": (
            "Indoor-outdoor venue, strong vegetarian menu, live acoustic music, "
            "smooth guest transportation, and a photography-forward schedule."
        ),
        "constraints": (
            "Avoid venues more than 45 minutes from downtown. Keep the design elevated "
            "without relying on heavy floral spend."
        ),
        "traditions": (
            "Blend a short western ceremony with a family tea ceremony. Include space "
            "for speeches from both families."
        ),
    }
