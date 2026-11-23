import network from "@/data/network.json";

export type RouteMode = "tram" | "bus";

export type RouteInfo = {
  id: string;
  shortName: string;
  longName: string;
  mode: RouteMode;
  color: string;
  textColor: string;
  directions: Record<string, string>;
};

export const routes = network.routes as RouteInfo[];

export const routeById = new Map(routes.map((route) => [route.id, route]));

export function routeFor(routeId: string | undefined) {
  if (!routeId) return undefined;
  return routeById.get(routeId);
}

export function destinationFor(route: RouteInfo | undefined, directionId?: number) {
  if (!route || directionId == null) return undefined;
  return route.directions[String(directionId)];
}

export function modeLabel(mode: RouteMode) {
  return mode === "tram" ? "Tram" : "Bus";
}
