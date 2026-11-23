import patternData from "@/data/patterns.json";
import shapeData from "@/data/shapes.json";

import { routeFor } from "@/lib/network";
import { stopById } from "@/lib/stops";

export type MapPoint = {
  latitude: number;
  longitude: number;
};

type RawShape = {
  mode: "tram" | "bus";
  color: string;
  paths: [number, number][][];
};

type RawPattern = {
  routeId: string;
  direction: number;
  stops: { id: string; t: number }[];
};

const shapes = shapeData as unknown as Record<string, RawShape>;
const patterns = patternData.patterns as RawPattern[];

export function routePaths(routeId: string): MapPoint[][] {
  const official = shapes[routeId];
  if (official) {
    return official.paths.map((path) => path.map(([latitude, longitude]) => ({ latitude, longitude })));
  }
  const pattern = patterns.find((item) => item.routeId === routeId);
  if (!pattern) return [];
  const path = pattern.stops.flatMap((stop) => {
    const place = stopById.get(stop.id);
    return place ? [{ latitude: place.lat, longitude: place.lon }] : [];
  });
  return path.length > 1 ? [path] : [];
}

export function routeColor(routeId: string) {
  return shapes[routeId]?.color ?? routeFor(routeId)?.color ?? "#8E8E93";
}

export function tramRouteIds() {
  return Object.entries(shapes)
    .filter(([, shape]) => shape.mode === "tram")
    .map(([routeId]) => routeId);
}

export function stopsAlong(routeId: string): MapPoint[] {
  const pattern = patterns.find((item) => item.routeId === routeId);
  if (!pattern) return [];
  return pattern.stops.flatMap((stop) => {
    const place = stopById.get(stop.id);
    return place ? [{ latitude: place.lat, longitude: place.lon }] : [];
  });
}

export function busRouteIds() {
  return Object.entries(shapes)
    .filter(([, shape]) => shape.mode === "bus")
    .map(([routeId]) => routeId);
}
