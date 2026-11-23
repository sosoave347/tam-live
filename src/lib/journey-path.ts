import patternData from "@/data/patterns.json";

import type { ActiveJourney } from "@/lib/journey";
import { routePaths, type MapPoint } from "@/lib/shapes";
import { distanceMeters, stopById, walkMinutes } from "@/lib/stops";

type PatternStop = { id: string; t: number };
type Pattern = { routeId: string; direction: number; stops: PatternStop[] };

const patterns = patternData.patterns as Pattern[];

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

export type Guide = {
  remainingMin: number;
  arriveAt: string;
  detail: string;
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

export function guideJourney(journey: ActiveJourney, here: MapPoint | null, now = new Date()): Guide {
  const planned = minutesFromNow(journey.itinerary.departAt, now);
  if (planned > 15) {
    return {
      remainingMin: journey.itinerary.totalMin,
      arriveAt: journey.itinerary.arriveAt,
      detail: `Départ ${journey.itinerary.departAt}`,
    };
  }
  if (!here) {
    return {
      remainingMin: journey.itinerary.totalMin,
      arriveAt: journey.itinerary.arriveAt,
      detail: stepLabel(journey, 0),
    };
  }
  if (distanceMeters(here.latitude, here.longitude, journey.destination.latitude, journey.destination.longitude) < 45) {
    return { remainingMin: 0, arriveAt: clock(now, 0), detail: "Arrivé" };
  }

  const drawn = drawJourney(journey);
  const steps = stepsOf(journey, drawn);
  let nearestStep = 0;
  let nearestMeters = Infinity;
  let nearestRatio = 1;
  steps.forEach((step, index) => {
    const hit = project(step.line, here);
    if (hit.meters < nearestMeters) {
      nearestMeters = hit.meters;
      nearestStep = index;
      nearestRatio = hit.remainingRatio;
    }
  });

  const closeEnough = nearestMeters < (steps[nearestStep]?.kind === "ride" ? 80 : 120);
  if (!closeEnough) {
    const board = steps.find((step) => step.kind === "ride")?.line[0] ?? drawn.destination;
    const walk = walkMinutes(distanceMeters(here.latitude, here.longitude, board.latitude, board.longitude));
    const ride = journey.itinerary.legs.reduce((sum, leg) => sum + leg.rideMin, 0);
    const remaining = walk + ride + journey.itinerary.walkOutMin;
    return { remainingMin: remaining, arriveAt: clock(now, remaining), detail: `À pied · ${walk} min` };
  }

  const current = steps[nearestStep];
  const left = Math.max(0, Math.round(current.minutes * nearestRatio));
  const later = steps.slice(nearestStep + 1).reduce((sum, step) => sum + step.minutes, 0);
  const remaining = left + later;
  return {
    remainingMin: remaining,
    arriveAt: clock(now, remaining),
    detail: remaining === 0 ? "Arrivé" : current.label,
  };
}

function rideTrace(routeId: string, board: MapPoint, alight: MapPoint) {
  const stops = rideStops(routeId, board, alight);
  const path = closestPath(routeId, board, alight);
  if (!path || stops.length < 2) return stops;
  const coordinates: MapPoint[] = [];
  for (let index = 0; index < stops.length - 1; index += 1) {
    const from = nearest(path, stops[index]);
    const to = nearest(path, stops[index + 1]);
    if (from.meters > 180 || to.meters > 180 || from.index === to.index) {
      coordinates.push(stops[index], stops[index + 1]);
      continue;
    }
    const hop = directedSlice(path, from.index, to.index);
    coordinates.push(...(pathLength(hop) > 1600 ? [stops[index], stops[index + 1]] : hop));
  }
  return dedupe([board, ...coordinates, alight]);
}

function rideStops(routeId: string, board: MapPoint, alight: MapPoint) {
  let best: MapPoint[] | null = null;
  let bestScore = Infinity;
  for (const pattern of patterns) {
    if (pattern.routeId !== routeId) continue;
    let boardIndex = -1;
    let boardGap = 160;
    pattern.stops.forEach((stop, index) => {
      const place = stopById.get(stop.id);
      if (!place) return;
      const gap = distanceMeters(place.lat, place.lon, board.latitude, board.longitude);
      if (gap < boardGap) {
        boardGap = gap;
        boardIndex = index;
      }
    });
    if (boardIndex < 0) continue;
    let alightIndex = -1;
    let alightGap = 160;
    for (let index = boardIndex + 1; index < pattern.stops.length; index += 1) {
      const place = stopById.get(pattern.stops[index].id);
      if (!place) continue;
      const gap = distanceMeters(place.lat, place.lon, alight.latitude, alight.longitude);
      if (gap < alightGap) {
        alightGap = gap;
        alightIndex = index;
      }
    }
    if (alightIndex < 0 || boardGap + alightGap >= bestScore) continue;
    bestScore = boardGap + alightGap;
    best = pattern.stops.slice(boardIndex, alightIndex + 1).flatMap((stop) => {
      const place = stopById.get(stop.id);
      return place ? [{ latitude: place.lat, longitude: place.lon }] : [];
    });
  }
  return best && best.length > 1 ? best : [board, alight];
}

function closestPath(routeId: string, board: MapPoint, alight: MapPoint) {
  let best: MapPoint[] | null = null;
  let bestScore = Infinity;
  for (const path of routePaths(routeId)) {
    if (path.length < 2) continue;
    const score = nearest(path, board).meters + nearest(path, alight).meters;
    if (score < bestScore) {
      bestScore = score;
      best = path;
    }
  }
  return bestScore < 500 ? best : null;
}

function directedSlice(path: MapPoint[], from: number, to: number) {
  const forward: MapPoint[] = [];
  const backward: MapPoint[] = [];
  for (let step = 0; step < path.length; step += 1) {
    forward.push(path[(from + step) % path.length]);
    if ((from + step) % path.length === to) break;
  }
  for (let step = 0; step < path.length; step += 1) {
    backward.push(path[(from - step + path.length * 2) % path.length]);
    if ((from - step + path.length * 2) % path.length === to) break;
  }
  return pathLength(forward) <= pathLength(backward) ? forward : backward;
}

function project(path: MapPoint[], here: MapPoint) {
  if (path.length === 1) {
    return { meters: distanceMeters(here.latitude, here.longitude, path[0].latitude, path[0].longitude), remainingRatio: 0 };
  }
  let walked = 0;
  let bestMeters = Infinity;
  let bestAlong = 0;
  let total = 0;
  for (let index = 0; index < path.length - 1; index += 1) {
    const start = path[index];
    const end = path[index + 1];
    const length = distanceMeters(start.latitude, start.longitude, end.latitude, end.longitude);
    const span = Math.max(length, 1);
    const dx = end.longitude - start.longitude;
    const dy = end.latitude - start.latitude;
    const raw = ((here.longitude - start.longitude) * dx + (here.latitude - start.latitude) * dy) / (dx * dx + dy * dy || 1);
    const ratio = Math.min(1, Math.max(0, raw));
    const point = { latitude: start.latitude + dy * ratio, longitude: start.longitude + dx * ratio };
    const meters = distanceMeters(here.latitude, here.longitude, point.latitude, point.longitude);
    const along = walked + span * ratio;
    if (meters < bestMeters) {
      bestMeters = meters;
      bestAlong = along;
    }
    walked += span;
    total += span;
  }
  return { meters: bestMeters, remainingRatio: total === 0 ? 0 : (total - bestAlong) / total };
}

function stepsOf(journey: ActiveJourney, drawn: JourneyDraw) {
  const steps: { kind: "walk" | "ride"; minutes: number; label: string; line: MapPoint[] }[] = [];
  const legs = journey.itinerary.legs;
  if (legs.length === 0) {
    steps.push({ kind: "walk", minutes: journey.itinerary.walkMin, label: "À pied", line: [drawn.origin, drawn.destination] });
    return steps;
  }
  if (journey.itinerary.walkInMin > 0) {
    steps.push({
      kind: "walk",
      minutes: journey.itinerary.walkInMin,
      label: `À pied vers ${legs[0].boardName}`,
      line: [drawn.origin, { latitude: legs[0].boardLatitude, longitude: legs[0].boardLongitude }],
    });
  }
  legs.forEach((leg, index) => {
    const mode = leg.mode === "tram" ? "Tram" : "Bus";
    steps.push({
      kind: "ride",
      minutes: leg.rideMin,
      label: `${mode} ${leg.shortName} vers ${leg.alightName}`,
      line: drawn.rides[index]?.coordinates ?? [
        { latitude: leg.boardLatitude, longitude: leg.boardLongitude },
        { latitude: leg.alightLatitude, longitude: leg.alightLongitude },
      ],
    });
  });
  const last = legs[legs.length - 1];
  if (journey.itinerary.walkOutMin > 0) {
    steps.push({
      kind: "walk",
      minutes: journey.itinerary.walkOutMin,
      label: "À pied jusqu'à l'arrivée",
      line: [{ latitude: last.alightLatitude, longitude: last.alightLongitude }, drawn.destination],
    });
  }
  return steps;
}

function stepLabel(journey: ActiveJourney, index: number) {
  const leg = journey.itinerary.legs[index];
  if (!leg) return "À pied";
  return `${leg.mode === "tram" ? "Tram" : "Bus"} ${leg.shortName}`;
}

function minutesFromNow(hhmm: string, now: Date) {
  const [hours, minutes] = hhmm.split(":").map(Number);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
  let diff = hours * 60 + minutes - (now.getHours() * 60 + now.getMinutes());
  if (diff < -12 * 60) diff += 24 * 60;
  return diff;
}

function clock(now: Date, plusMinutes: number) {
  const date = new Date(now.getTime() + plusMinutes * 60_000);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function pathLength(path: MapPoint[]) {
  let total = 0;
  for (let index = 1; index < path.length; index += 1) {
    total += distanceMeters(path[index - 1].latitude, path[index - 1].longitude, path[index].latitude, path[index].longitude);
  }
  return total;
}

function dedupe(path: MapPoint[]) {
  return path.filter((item, index) => {
    const previous = path[index - 1];
    return !previous || distanceMeters(previous.latitude, previous.longitude, item.latitude, item.longitude) > 8;
  });
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

function point(value: { latitude: number; longitude: number }): MapPoint {
  return { latitude: value.latitude, longitude: value.longitude };
}
