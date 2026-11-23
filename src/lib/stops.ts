import catalog from "@/data/stops.json";

import { routeFor, type RouteMode } from "@/lib/network";

export type StopInfo = {
  id: string;
  name: string;
  lat: number;
  lon: number;
};

export const stops = catalog.stops as StopInfo[];
export const routesByStop = catalog.routesByStop as Record<string, string[]>;
export const stopById = new Map(stops.map((stop) => [stop.id, stop]));

export type StopCluster = {
  name: string;
  latitude: number;
  longitude: number;
  distance: number;
  ids: string[];
  routeIds: string[];
};

export function nearbyStops(
  latitude: number,
  longitude: number,
  limit = 5,
  maxMeters = 800,
  mode?: RouteMode,
) {
  const ranked: { stop: StopInfo; distance: number }[] = [];
  for (const stop of stops) {
    const distance = distanceMeters(latitude, longitude, stop.lat, stop.lon);
    if (distance <= maxMeters) ranked.push({ stop, distance });
  }
  ranked.sort((left, right) => left.distance - right.distance);

  const clusters: StopCluster[] = [];
  for (const item of ranked) {
    const serves = servesMode(item.stop.id, mode);
    const key = item.stop.name.trim().toLowerCase();
    const existing = clusters.find(
      (cluster) =>
        cluster.name.trim().toLowerCase() === key &&
        distanceMeters(cluster.latitude, cluster.longitude, item.stop.lat, item.stop.lon) < 160,
    );
    if (existing) {
      if (!serves) continue;
      existing.ids.push(item.stop.id);
      for (const routeId of routesByStop[item.stop.id] ?? []) {
        if (!existing.routeIds.includes(routeId)) existing.routeIds.push(routeId);
      }
      continue;
    }
    if (!serves || clusters.length >= limit) continue;
    clusters.push({
      name: item.stop.name,
      latitude: item.stop.lat,
      longitude: item.stop.lon,
      distance: item.distance,
      ids: [item.stop.id],
      routeIds: [...(routesByStop[item.stop.id] ?? [])],
    });
  }
  return clusters;
}

function servesMode(stopId: string, mode?: RouteMode) {
  if (!mode) return true;
  return (routesByStop[stopId] ?? []).some((routeId) => routeFor(routeId)?.mode === mode);
}

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earth = 6371000;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) ** 2;
  return 2 * earth * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function walkMinutes(meters: number) {
  return Math.max(1, Math.round(meters / 80));
}
