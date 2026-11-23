import type { LiveTrip, ServiceAlert } from "@/lib/gtfs-rt";
import { destinationFor, routeFor } from "@/lib/network";
import { nearbyStops, type StopCluster, walkMinutes } from "@/lib/stops";

export type PlacePoint = {
  latitude: number;
  longitude: number;
};

export type RidePlan = {
  routeId: string;
  mode: "tram" | "bus";
  shortName: string;
  color: string;
  textColor: string;
  boardName: string;
  alightName: string;
  boardLatitude: number;
  boardLongitude: number;
  boardDistance: number;
  alightDistance: number;
  walkMinutes: number;
  departureTime?: number;
  directionId?: number;
  destination?: string;
  disrupted: boolean;
};

export type StopArrival = {
  routeId: string;
  shortName: string;
  color: string;
  textColor: string;
  mode: "tram" | "bus";
  time: number;
  directionId?: number;
  destination?: string;
  disrupted: boolean;
};

const SEARCH_RADIUS = 850;

export function plansBetween(
  origin: PlacePoint,
  destination: PlacePoint,
  trips: LiveTrip[],
  alerts: ServiceAlert[],
  nowSeconds = Date.now() / 1000,
) {
  const origins = nearbyStops(origin.latitude, origin.longitude, 8, SEARCH_RADIUS);
  const destinations = nearbyStops(destination.latitude, destination.longitude, 8, SEARCH_RADIUS);
  const originByStop = indexClusters(origins);
  const destinationByStop = indexClusters(destinations);
  const best = new Map<string, RidePlan>();

  for (const trip of trips) {
    let board: { cluster: StopCluster; time: number } | null = null;
    for (const pass of trip.passes) {
      if (!board) {
        const cluster = originByStop.get(pass.stopId);
        if (cluster && pass.time >= nowSeconds - 20) board = { cluster, time: pass.time };
        continue;
      }
      const alight = destinationByStop.get(pass.stopId);
      if (!alight || pass.time < board.time + 60) continue;
      const plan = makePlan(trip, board.cluster, alight, board.time, alerts);
      const current = best.get(plan.routeId);
      if (!current || (plan.departureTime ?? Infinity) < (current.departureTime ?? Infinity)) {
        best.set(plan.routeId, plan);
      }
      break;
    }
  }

  const live = [...best.values()].sort(comparePlans);
  if (live.length > 0) return live.slice(0, 4);
  return staticPlans(origins, destinations, alerts).slice(0, 4);
}

export function arrivalsNear(point: PlacePoint, trips: LiveTrip[], alerts: ServiceAlert[], nowSeconds = Date.now() / 1000) {
  const clusters = nearbyStops(point.latitude, point.longitude, 4, 700);
  return clusters.map((cluster) => {
    const ids = new Set(cluster.ids);
    const seen = new Set<string>();
    const next: StopArrival[] = [];
    for (const trip of trips) {
      if (seen.has(trip.routeId)) continue;
      const pass = trip.passes.find((item) => ids.has(item.stopId) && item.time >= nowSeconds - 20);
      if (!pass) continue;
      seen.add(trip.routeId);
      const route = routeFor(trip.routeId);
      next.push({
        routeId: trip.routeId,
        shortName: route?.shortName ?? trip.routeId,
        color: route?.color ?? "#8B93A7",
        textColor: route?.textColor ?? "#FFFFFF",
        mode: route?.mode ?? "bus",
        time: pass.time,
        directionId: trip.directionId,
        destination: destinationFor(route, trip.directionId),
        disrupted: alertFor(alerts, trip.routeId),
      });
    }
    next.sort((left, right) => left.time - right.time);
    return { cluster, next: next.slice(0, 3) };
  });
}

export function formatWait(epochSeconds: number | undefined, now = Date.now()) {
  if (epochSeconds == null) return "horaire non annoncé";
  const minutes = Math.round((epochSeconds * 1000 - now) / 60000);
  if (minutes <= 0) return "maintenant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}`;
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function indexClusters(clusters: StopCluster[]) {
  const index = new Map<string, StopCluster>();
  for (const cluster of clusters) {
    for (const id of cluster.ids) index.set(id, cluster);
  }
  return index;
}

function makePlan(
  trip: LiveTrip,
  board: StopCluster,
  alight: StopCluster,
  departureTime: number,
  alerts: ServiceAlert[],
): RidePlan {
  const route = routeFor(trip.routeId);
  return {
    routeId: trip.routeId,
    mode: route?.mode ?? "bus",
    shortName: route?.shortName ?? trip.routeId,
    color: route?.color ?? "#8B93A7",
    textColor: route?.textColor ?? "#FFFFFF",
    boardName: board.name,
    alightName: alight.name,
    boardLatitude: board.latitude,
    boardLongitude: board.longitude,
    boardDistance: board.distance,
    alightDistance: alight.distance,
    walkMinutes: walkMinutes(board.distance),
    departureTime,
    directionId: trip.directionId,
    destination: destinationFor(route, trip.directionId),
    disrupted: alertFor(alerts, trip.routeId),
  };
}

function staticPlans(origins: StopCluster[], destinations: StopCluster[], alerts: ServiceAlert[]) {
  const plans: RidePlan[] = [];
  for (const origin of origins) {
    for (const routeId of origin.routeIds) {
      const destination = destinations.find((cluster) => cluster.routeIds.includes(routeId));
      if (!destination) continue;
      if (plans.some((plan) => plan.routeId === routeId)) continue;
      const route = routeFor(routeId);
      plans.push({
        routeId,
        mode: route?.mode ?? "bus",
        shortName: route?.shortName ?? routeId,
        color: route?.color ?? "#8B93A7",
        textColor: route?.textColor ?? "#FFFFFF",
        boardName: origin.name,
        alightName: destination.name,
        boardLatitude: origin.latitude,
        boardLongitude: origin.longitude,
        boardDistance: origin.distance,
        alightDistance: destination.distance,
        walkMinutes: walkMinutes(origin.distance),
        disrupted: alertFor(alerts, routeId),
      });
    }
  }
  return plans.sort((left, right) => left.boardDistance + left.alightDistance - (right.boardDistance + right.alightDistance));
}

function comparePlans(left: RidePlan, right: RidePlan) {
  const leftWait = left.departureTime ?? Number.MAX_SAFE_INTEGER;
  const rightWait = right.departureTime ?? Number.MAX_SAFE_INTEGER;
  if (leftWait !== rightWait) return leftWait - rightWait;
  return left.boardDistance - right.boardDistance;
}

function alertFor(alerts: ServiceAlert[], routeId: string) {
  return alerts.some((alert) => alert.routeIds.includes(routeId));
}
