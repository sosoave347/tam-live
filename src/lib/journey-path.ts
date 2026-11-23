import type { ActiveJourney } from "@/lib/journey";
import { routePaths, type MapPoint } from "@/lib/shapes";
import { distanceMeters } from "@/lib/stops";

export type JourneyMarker = MapPoint & {
  key: string;
  title: string;
  subtitle: string;
  color: string;
  textColor: string;
  label: string;
};

export type JourneyDraw = {
  origin: MapPoint;
  destination: MapPoint;
  walks: MapPoint[][];
  rides: { key: string; color: string; coordinates: MapPoint[] }[];
  markers: JourneyMarker[];
};

export function drawJourney(journey: ActiveJourney): JourneyDraw {
  const origin = point(journey.origin);
  const destination = point(journey.destination);
  const walks: MapPoint[][] = [];
  const rides: JourneyDraw["rides"] = [];
  const markers: JourneyMarker[] = [];
  let cursor = origin;

  if (journey.itinerary.legs.length === 0) {
    walks.push([origin, destination]);
  } else {
    journey.itinerary.legs.forEach((leg, index) => {
      const board = { latitude: leg.boardLatitude, longitude: leg.boardLongitude };
      const alight = { latitude: leg.alightLatitude, longitude: leg.alightLongitude };
      if (distanceMeters(cursor.latitude, cursor.longitude, board.latitude, board.longitude) > 30) {
        walks.push([cursor, board]);
      }
      rides.push({
        key: `${leg.routeId}-${index}`,
        color: leg.color,
        coordinates: rideTrace(leg.routeId, board, alight),
      });
      markers.push({
        ...board,
        key: `board-${index}`,
        title: leg.boardName,
        subtitle: leg.boardAt,
        color: leg.color,
        textColor: leg.textColor,
        label: leg.shortName,
      });
      const next = journey.itinerary.legs[index + 1];
      const sameStop =
        next != null &&
        distanceMeters(alight.latitude, alight.longitude, next.boardLatitude, next.boardLongitude) < 40;
      if (!sameStop) {
        markers.push({
          ...alight,
          key: `alight-${index}`,
          title: leg.alightName,
          subtitle: leg.alightAt,
          color: leg.color,
          textColor: "#1C1C1E",
          label: "",
        });
      }
      cursor = alight;
    });
    if (distanceMeters(cursor.latitude, cursor.longitude, destination.latitude, destination.longitude) > 30) {
      walks.push([cursor, destination]);
    }
  }

  return { origin, destination, walks, rides, markers };
}

function rideTrace(routeId: string, board: MapPoint, alight: MapPoint) {
  let best: { path: MapPoint[]; start: number; end: number; score: number } | null = null;
  for (const path of routePaths(routeId)) {
    if (path.length < 2) continue;
    const start = nearest(path, board);
    const end = nearest(path, alight);
    const score = start.meters + end.meters;
    if (!best || score < best.score) best = { path, start: start.index, end: end.index, score };
  }
  if (!best || best.score > 500 || best.start === best.end) return [board, alight];
  const slice = best.start < best.end ? best.path.slice(best.start, best.end + 1) : best.path.slice(best.end, best.start + 1).reverse();
  return [board, ...thin(slice), alight];
}

function nearest(path: MapPoint[], target: MapPoint) {
  let index = 0;
  let meters = Infinity;
  for (let cursor = 0; cursor < path.length; cursor += 1) {
    const gap = distanceMeters(path[cursor].latitude, path[cursor].longitude, target.latitude, target.longitude);
    if (gap < meters) {
      meters = gap;
      index = cursor;
    }
  }
  return { index, meters };
}

function thin(path: MapPoint[]) {
  if (path.length <= 80) return path;
  return path.filter((_, index) => index % 2 === 0 || index === path.length - 1);
}

function point(value: { latitude: number; longitude: number }): MapPoint {
  return { latitude: value.latitude, longitude: value.longitude };
}
