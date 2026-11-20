"""Build data/us_places.csv from the Census 2024 Gazetteer places file.

Usage: python scripts/build_places_snapshot.py <2024_Gaz_place_national.txt>

Download the zip from
https://www.census.gov/geographies/reference-files/time-series/geo/gazetteer-files.2024.html
and extract the tab-delimited .txt file.
"""

import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from vows_n_knots.locations import US_STATES  # noqa: E402

OUTPUT = Path(__file__).resolve().parents[1] / "data" / "us_places.csv"


def build(source: Path, output: Path = OUTPUT) -> int:
    rows = []
    with open(source, newline="", encoding="utf-8-sig") as f:
        reader = csv.reader(f, delimiter="\t")
        header = [h.strip() for h in next(reader)]
        usps, geoid, name = (header.index(c) for c in ("USPS", "GEOID", "NAME"))
        for row in reader:
            if row[usps].strip() in US_STATES:
                rows.append((row[usps].strip(), row[geoid].strip(), row[name].strip()))
    output.parent.mkdir(parents=True, exist_ok=True)
    with open(output, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f, lineterminator="\n")
        writer.writerow(["state_code", "place_id", "name"])
        writer.writerows(rows)
    return len(rows)


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    print(f"Wrote {build(Path(sys.argv[1]))} rows to {OUTPUT}")
