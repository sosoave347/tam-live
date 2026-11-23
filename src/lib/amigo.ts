import patternData from "@/data/patterns.json";

import type { LiveTrip } from "@/lib/gtfs-rt";
import { destinationFor, routeFor } from "@/lib/network";
import { clockFrom, scheduledWait } from "@/lib/schedule";
import { distanceMeters, nearbyStops, stopById, walkMinutes, type StopCluster } from "@/lib/stops";

export type TripPreference = "fast" | "tram" | "bus" | "direct";

export type JourneyLeg = {
  routeId: string;
  shortName: string;
  color: string;
  textColor: string;
  mode: "tram" | "bus";
  boardName: string;
  alightName: string;
  boardLatitude: number;
  boardLongitude: number;
  alightLatitude: number;
  alightLongitude: number;
  rideMin: number;
  waitMin: number;
  boardAt?: string;
  destination?: string;
};

export type Itinerary = {
  id: string;
  totalMin: number;
  walkMin: number;
  transfers: number;
  legs: JourneyLeg[];
  summary: string;
};

type PatternStop = { id: string; t: number };
type Pattern = { routeId: string; direction: number; stops: PatternStop[] };
type Visit = { patternIndex: number; stopIndex: number };

const patterns = patternData.patterns as Pattern[];
const visitsByStop = new Map<string, Visit[]>();
patterns.forEach((pattern, patternIndex) => {
  pattern.stops.forEach((stop, stopIndex) => {
    const list = visitsByStop.get(stop.id) ?? [];
    list.push({ patternIndex, stopIndex });
    visitsByStop.set(stop.id, list);
  });
});

export function planJourney(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  trips: LiveTrip[],
  preference: TripPreference,
  nowSeconds = Date.now() / 1000,
  departAt?: number | null,
): Itinerary[] {
  const scheduled = departAt != null && departAt > nowSeconds + 15 * 60;
  const moment = scheduled ? departAt : nowSeconds;
  const liveByRoute = new Map<string, LiveTrip[]>();
  for (const trip of trips) {
    const list = liveByRoute.get(trip.routeId) ?? [];
    list.push(trip);
    liveByRoute.set(trip.routeId, list);
  }
  const origins = accessStops(origin.latitude, origin.longitude, preference);
  const destinations = accessStops(destination.latitude, destination.longitude, preference);
  const originIds = idsOf(origins);
  const destinationIds = idsOf(destinations);
  const found: Itinerary[] = [];

  const walk = walkMinutes(distanceMeters(origin.latitude, origin.longitude, destination.latitude, destination.longitude));
  if (walk <= 28 && preference !== "tram" && preference !== "bus") {
    found.push({
      id: "walk",
      totalMin: walk,
      walkMin: walk,
      transfers: 0,
      legs: [],
      summary: "À pied, sans transport",
    });
  }

  patterns.forEach((pattern, patternIndex) => {
    if (!allows(pattern.routeId, preference)) return;
    const board = firstStop(pattern, originIds, 0);
    if (!board) return;
    const alight = firstStop(pattern, destinationIds, board.index + 1);
    if (alight) {
      const direct = ride(pattern, board, alight, origins, destinations, liveByRoute, moment, scheduled, origin);
      if (direct) {
        const itinerary = build([direct.leg], origin, destination);
        if (itinerary) found.push(itinerary);
      }
      if (preference === "direct") return;
    }
    if (preference === "direct") return;

    for (let index = board.index + 1; index < pattern.stops.length && found.length < 180; index += 1) {
      const transferId = pattern.stops[index].id;
      const connections = visitsByStop.get(transferId) ?? [];
      for (const visit of connections) {
        if (visit.patternIndex === patternIndex) continue;
        const next = patterns[visit.patternIndex];
        if (!allows(next.routeId, preference) || next.routeId === pattern.routeId) continue;
        const nextAlight = firstStop(next, destinationIds, visit.stopIndex + 1);
        if (!nextAlight) continue;
        const first = ride(
          pattern,
          board,
          { index, stop: pattern.stops[index] },
          origins,
          destinations,
          liveByRoute,
          moment,
          scheduled,
          origin,
        );
        if (!first) continue;
        const second = ride(
          next,
          { index: visit.stopIndex, stop: next.stops[visit.stopIndex] },
          nextAlight,
          origins,
          destinations,
          liveByRoute,
          first.departSeconds + first.leg.rideMin * 60,
          scheduled,
          origin,
          true,
        );
        if (!second) continue;
        const itinerary = build([first.leg, second.leg], origin, destination);
        if (itinerary) found.push(itinerary);
      }
    }
  });

  const unique = new Map<string, Itinerary>();
  for (const itinerary of found) {
    const current = unique.get(itinerary.id);
    if (!current || itinerary.totalMin < current.totalMin) unique.set(itinerary.id, itinerary);
  }
  return pickResults([...unique.values()], preference);
}

function accessStops(latitude: number, longitude: number, preference: TripPreference) {
  if (preference === "tram") return nearbyStops(latitude, longitude, 8, 1600, "tram");
  if (preference === "bus") return nearbyStops(latitude, longitude, 8, 1200, "bus");
  return mergeClusters(
    nearbyStops(latitude, longitude, 6, 1600, "tram"),
    nearbyStops(latitude, longitude, 6, 1000, "bus"),
  );
}

function mergeClusters(trams: StopCluster[], buses: StopCluster[]) {
  const merged = [...trams];
  for (const cluster of buses) {
    if (merged.some((item) => item.ids.some((id) => cluster.ids.includes(id)))) continue;
    merged.push(cluster);
  }
  return merged;
}

function pickResults(list: Itinerary[], preference: TripPreference) {
  const sorted = list.sort((left, right) => left.totalMin - right.totalMin || left.transfers - right.transfers);
  if (preference !== "fast") return sorted.slice(0, 4);
  const picked: Itinerary[] = [];
  const push = (item: Itinerary | undefined) => {
    if (!item || picked.some((current) => current.id === item.id)) return;
    picked.push(item);
  };
  push(sorted[0]);
  push(sorted.find((item) => item.legs.some((leg) => leg.mode === "tram")));
  push(sorted.find((item) => item.legs.length === 1));
  for (const item of sorted) {
    if (picked.length >= 4) break;
    push(item);
  }
  return picked.sort((left, right) => left.totalMin - right.totalMin);
}

function idsOf(clusters: StopCluster[]) {
  const ids = new Set<string>();
  for (const cluster of clusters) for (const id of cluster.ids) ids.add(id);
  return ids;
}

function allows(routeId: string, preference: TripPreference) {
  if (preference === "fast" || preference === "direct") return true;
  return routeFor(routeId)?.mode === preference;
}

function firstStop(pattern: Pattern, ids: Set<string>, from: number) {
  for (let index = from; index < pattern.stops.length; index += 1) {
    if (ids.has(pattern.stops[index].id)) return { index, stop: pattern.stops[index] };
  }
  return null;
}

function ride(
  pattern: Pattern,
  board: { index: number; stop: PatternStop },
  alight: { index: number; stop: PatternStop },
  origins: StopCluster[],
  destinations: StopCluster[],
  liveByRoute: Map<string, LiveTrip[]>,
  whenSeconds: number,
  scheduled: boolean,
  origin: { latitude: number; longitude: number },
  transfer = false,
): { leg: JourneyLeg; departSeconds: number } | null {
  const route = routeFor(pattern.routeId);
  const boardPlace = stopById.get(board.stop.id);
  const alightPlace = stopById.get(alight.stop.id);
  const boardCluster = clusterFor(board.stop.id, origins);
  const alightCluster = clusterFor(alight.stop.id, destinations);
  const boardLatitude = boardPlace?.lat ?? boardCluster?.latitude ?? 0;
  const boardLongitude = boardPlace?.lon ?? boardCluster?.longitude ?? 0;
  const ready = transfer || !scheduled
    ? whenSeconds
    : whenSeconds + walkMinutes(distanceMeters(origin.latitude, origin.longitude, boardLatitude, boardLongitude)) * 60;
  let waitMin = transfer ? 3 : waitFor(board.stop.id, alight.stop.id, liveByRoute.get(pattern.routeId) ?? [], whenSeconds, route?.mode);
  let boardAt: string | undefined;
  if (scheduled) {
    const wait = scheduledWait(pattern.routeId, pattern.direction, board.stop.t, ready);
    if (wait == null) return null;
    waitMin = wait;
    boardAt = clockFrom(ready, wait);
  }
  return {
    departSeconds: ready + waitMin * 60,
    leg: {
      routeId: pattern.routeId,
      shortName: route?.shortName ?? pattern.routeId,
      color: route?.color ?? "#8E8E93",
      textColor: route?.textColor ?? "#FFFFFF",
      mode: route?.mode ?? "bus",
      boardName: boardCluster?.name ?? boardPlace?.name ?? "Arrêt",
      alightName: alightCluster?.name ?? alightPlace?.name ?? "Arrêt",
      boardLatitude,
      boardLongitude,
      alightLatitude: alightPlace?.lat ?? alightCluster?.latitude ?? 0,
      alightLongitude: alightPlace?.lon ?? alightCluster?.longitude ?? 0,
      rideMin: Math.max(1, Math.round((alight.stop.t - board.stop.t) / 60)),
      waitMin,
      boardAt,
      destination: destinationFor(route, pattern.direction),
    },
  };
}

function waitFor(
  boardId: string,
  alightId: string,
  trips: LiveTrip[],
  nowSeconds: number,
  mode: "tram" | "bus" | undefined,
) {
  let best: number | null = null;
  for (const trip of trips) {
    const board = trip.passes.find((pass) => pass.stopId === boardId && pass.time >= nowSeconds - 30);
    if (!board) continue;
    const alight = trip.passes.find((pass) => pass.stopId === alightId && pass.time > board.time);
    if (!alight) continue;
    const minutes = Math.max(0, Math.round((board.time - nowSeconds) / 60));
    if (best == null || minutes < best) best = minutes;
  }
  if (best != null) return best;
  return mode === "tram" ? 4 : 7;
}

function clusterFor(stopId: string, clusters: StopCluster[]) {
  return clusters.find((cluster) => cluster.ids.includes(stopId));
}

function build(
  legs: JourneyLeg[],
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): Itinerary | null {
  if (legs.some((leg) => leg.rideMin <= 0 || !leg.boardLatitude || !leg.alightLatitude)) return null;
  const walkIn = walkMinutes(distanceMeters(origin.latitude, origin.longitude, legs[0].boardLatitude, legs[0].boardLongitude));
  const last = legs[legs.length - 1];
  const walkOut = walkMinutes(distanceMeters(destination.latitude, destination.longitude, last.alightLatitude, last.alightLongitude));
  const ride = legs.reduce((sum, leg) => sum + leg.rideMin + leg.waitMin, 0);
  const walkMin = walkIn + walkOut;
  const names = legs.map((leg) => leg.shortName).join(" puis ");
  return {
    id: legs.map((leg) => `${leg.routeId}:${leg.boardName}:${leg.alightName}`).join(">"),
    totalMin: walkMin + ride + Math.max(0, legs.length - 1) * 2,
    walkMin,
    transfers: Math.max(0, legs.length - 1),
    legs,
    summary: legs.length === 1 ? `${names} · ${walkMin} min à pied` : `${names} · ${walkMin} min à pied`,
  };
}
