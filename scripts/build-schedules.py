#!/usr/bin/env python3
"""Compact weekday/Saturday/Sunday departures from the official TaM GTFS."""

import csv
import io
import json
import zipfile
from collections import defaultdict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
GTFS = Path("/tmp/tam-gtfs/GTFS.zip")
PATTERNS = ROOT / "src" / "data" / "patterns.json"
OUTPUT = ROOT / "src" / "data" / "schedules.json"


def rows(archive, name):
    return csv.DictReader(io.TextIOWrapper(archive.open(name), encoding="utf-8-sig"))


def day_kind(day):
    return "su" if day == 6 else "sa" if day == 5 else "wd"


def minutes(value):
    if not value:
        return None
    hour, minute, _second = value.split(":")
    return int(hour) * 60 + int(minute)


def main():
    patterns = json.loads(PATTERNS.read_text(encoding="utf-8"))["patterns"]
    origin = {(pattern["routeId"], pattern["direction"]): pattern["stops"][0]["id"] for pattern in patterns}

    with zipfile.ZipFile(GTFS) as archive:
        dates = defaultdict(set)
        for row in rows(archive, "calendar_dates.txt"):
            if row["exception_type"] != "1":
                continue
            stamp = row["date"]
            day = date(int(stamp[:4]), int(stamp[4:6]), int(stamp[6:8])).weekday()
            dates[row["service_id"]].add((day_kind(day), stamp))

        trips = list(rows(archive, "trips.txt"))
        trip_counts = defaultdict(int)
        trip_meta = {}
        for trip in trips:
            route_id = trip["route_id"]
            direction = int(trip.get("direction_id") or 0)
            if (route_id, direction) not in origin:
                continue
            service = trip["service_id"]
            trip_counts[(route_id, direction, service)] += 1
            trip_meta[trip["trip_id"]] = (route_id, direction, service)

        chosen = {}
        for (route_id, direction, service), count in trip_counts.items():
            for kind, _stamp in dates.get(service, ()):
                key = (route_id, direction, kind)
                score = count * sum(1 for item, _stamp in dates[service] if item == kind)
                if key not in chosen or score > chosen[key][0]:
                    chosen[key] = (score, service)

        wanted = {}
        for (route_id, direction, kind), (_score, service) in chosen.items():
            for trip_id, meta in trip_meta.items():
                if meta == (route_id, direction, service):
                    wanted[trip_id] = (route_id, direction, kind, origin[(route_id, direction)])

        times = defaultdict(set)
        for row in rows(archive, "stop_times.txt"):
            meta = wanted.get(row["trip_id"])
            if not meta or row["stop_id"] != meta[3]:
                continue
            minute = minutes(row.get("departure_time") or row.get("arrival_time"))
            if minute is None:
                continue
            times[(meta[0], meta[1], meta[2])].add(minute)

    payload = {}
    for (route_id, direction, kind), minutes_set in times.items():
        payload.setdefault(route_id, {}).setdefault(str(direction), {})[kind] = sorted(minutes_set)

    OUTPUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"{OUTPUT.stat().st_size // 1024} Ko, {len(payload)} lignes")


if __name__ == "__main__":
    main()
