"""US location data: states and Census places."""

import csv
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

US_STATES: dict[str, str] = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "DC": "District of Columbia", "FL": "Florida", "GA": "Georgia", "HI": "Hawaii",
    "ID": "Idaho", "IL": "Illinois", "IN": "Indiana", "IA": "Iowa",
    "KS": "Kansas", "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine",
    "MD": "Maryland", "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota",
    "MS": "Mississippi", "MO": "Missouri", "MT": "Montana", "NE": "Nebraska",
    "NV": "Nevada", "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico",
    "NY": "New York", "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio",
    "OK": "Oklahoma", "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island",
    "SC": "South Carolina", "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas",
    "UT": "Utah", "VT": "Vermont", "VA": "Virginia", "WA": "Washington",
    "WV": "West Virginia", "WI": "Wisconsin", "WY": "Wyoming",
}

_LEGAL_SUFFIXES = {"city", "town", "village", "borough", "cdp"}
_GOVERNMENT_SUFFIXES = (
    "city and borough",
    "metropolitan government",
    "metro government",
    "unified government",
    "consolidated government",
    "urban county",
    "municipality",
)
_BALANCE = " (balance)"
_SAINT_WORDS = {"st.": "saint", "st": "saint"}
_HEAD_SEPARATOR = re.compile(r"[-/]")


@dataclass(frozen=True)
class Place:
    place_id: str
    state_code: str
    name: str


def load_places(path: Path) -> list[Place]:
    with open(path, newline="", encoding="utf-8") as f:
        return [
            Place(place_id=row["place_id"], state_code=row["state_code"], name=row["name"])
            for row in csv.DictReader(f)
        ]


def _clean(name: str) -> str:
    """Lowercase, collapse whitespace, and spell "St." / "St" as "saint"."""
    return " ".join(_SAINT_WORDS.get(word, word) for word in name.lower().split())


def _drop_legal_suffix(key: str) -> str:
    words = key.split()
    if len(words) > 1 and words[-1] in _LEGAL_SUFFIXES:
        words.pop()
    return " ".join(words)


def normalize_city(name: str) -> str:
    """Drop "(balance)", then a government-type phrase or one legal suffix word."""
    key = _clean(name)
    if key.endswith(_BALANCE):
        key = key[: -len(_BALANCE)]
    for phrase in _GOVERNMENT_SUFFIXES:
        if key.endswith(" " + phrase):
            return key[: -len(phrase) - 1]
    return _drop_legal_suffix(key)


def _alternate_keys(key: str) -> set[str]:
    """Other names a normalized place key is known by: the part before the first
    "-" or "/", the name without a leading "urban ", and "Boise City" as "Boise"."""
    alternates = {_HEAD_SEPARATOR.split(key, maxsplit=1)[0].strip(), _drop_legal_suffix(key)}
    if key.startswith("urban "):
        alternates.add(key[len("urban "):])
    alternates.discard("")
    alternates.discard(key)
    return alternates


def find_place(places: Sequence[Place], state_code: str, city: str) -> Place | None:
    """Match the place's name exactly first, then its alternate names, then the
    input with its own legal suffix dropped. Within a tier an incorporated place
    wins over a CDP; otherwise the first in file order wins."""
    exact = _clean(city)
    stripped = normalize_city(city)
    best: Place | None = None
    best_rank: tuple[int, bool] | None = None
    for place in places:
        if place.state_code != state_code:
            continue
        key = normalize_city(place.name)
        alternates = _alternate_keys(key)
        if key == exact:
            tier = 0
        elif exact in alternates:
            tier = 1
        elif stripped == key or stripped in alternates:
            tier = 2
        else:
            continue
        rank = (tier, place.name.lower().endswith(" cdp"))
        if best_rank is None or rank < best_rank:
            best, best_rank = place, rank
    return best
