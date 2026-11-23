#!/usr/bin/env python3
"""Rebuild src/data/network.json from the official TaM GTFS."""

import csv
import io
import json
import urllib.request
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

GTFS_URL = "https://gtfsproxy.e-tam.fr/COMMON/GTFS.zip"
OUTPUT = Path(__file__).resolve().parents[1] / "src" / "data" / "network.json"


def sort_key(route):
    name = route["route_short_name"]
    kind = 0 if route["route_type"] == "0" else 1
    if name.isdigit():
        return (kind, 0, int(name), name)
    return (kind, 1, 0, name)


def main():
    with urllib.request.urlopen(GTFS_URL) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))

    def rows(name):
        return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding="utf-8-sig"))

    headsigns = defaultdict(Counter)
    for trip in rows("trips.txt"):
        headsign = (trip.get("trip_headsign") or "").strip()
        if headsign:
            headsigns[(trip["route_id"], trip.get("direction_id") or "")][headsign] += 1

    routes = []
    for route in sorted(rows("routes.txt"), key=sort_key):
        directions = {}
        for direction in ("0", "1"):
            counts = headsigns.get((route["route_id"], direction))
            if counts:
                directions[direction] = counts.most_common(1)[0][0]
        color = (route.get("route_color") or "1B4F8A").strip()
        text = (route.get("route_text_color") or "FFFFFF").strip()
        routes.append(
            {
                "id": route["route_id"],
                "shortName": route["route_short_name"],
                "longName": route["route_long_name"],
                "mode": "tram" if route["route_type"] == "0" else "bus",
                "color": f"#{color}",
                "textColor": f"#{text}",
                "directions": directions,
            }
        )

    payload = {
        "source": GTFS_URL,
        "license": "ODbL",
        "attribution": "Montpellier Méditerranée Métropole / TaM",
        "routes": routes,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"{len(routes)} lignes écrites dans {OUTPUT}")

    trip_route = {trip["trip_id"]: trip["route_id"] for trip in rows("trips.txt")}
    served = defaultdict(set)
    for stop_time in rows("stop_times.txt"):
        route_id = trip_route.get(stop_time["trip_id"])
        if route_id:
            served[stop_time["stop_id"]].add(route_id)

    stops = []
    for stop in rows("stops.txt"):
        if (stop.get("location_type") or "0") not in ("0", ""):
            continue
        name = (stop.get("stop_name") or "").strip()
        if not name:
            continue
        stops.append(
            {
                "id": stop["stop_id"],
                "name": name,
                "lat": round(float(stop["stop_lat"]), 5),
                "lon": round(float(stop["stop_lon"]), 5),
            }
        )

    def route_sort(route_id):
        return (not route_id.isdigit(), int(route_id) if route_id.isdigit() else 0, route_id)

    stops_path = OUTPUT.parent / "stops.json"
    stops_path.write_text(
        json.dumps(
            {
                "stops": stops,
                "routesByStop": {stop_id: sorted(route_ids, key=route_sort) for stop_id, route_ids in served.items()},
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"{len(stops)} arrêts écrits dans {stops_path}")


if __name__ == "__main__":
    main()
