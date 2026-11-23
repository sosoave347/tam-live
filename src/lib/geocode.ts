import * as Location from "expo-location";

export type GeoPoint = {
  latitude: number;
  longitude: number;
  address: string;
};

const COMMUNES = [
  "Montpellier",
  "Castelnau-le-Lez",
  "Lattes",
  "Pérols",
  "Saint-Jean-de-Védas",
  "Clapiers",
  "Jacou",
  "Grabels",
  "Juvignac",
  "Le Crès",
  "Lavérune",
  "Palavas-les-Flots",
  "Vendargues",
  "Baillargues",
  "Villeneuve-lès-Maguelone",
  "Castries",
  "Montferrier-sur-Lez",
  "Prades-le-Lez",
  "Pignan",
  "Fabrègues",
  "Cournonterral",
  "Cournonsec",
  "Saussan",
  "Saint-Georges-d'Orques",
  "Murviel-lès-Montpellier",
  "Beaulieu",
  "Restinclières",
  "Saint-Brès",
  "Saint-Drézéry",
  "Saint-Geniès-des-Mourgues",
  "Sussargues",
];

const ALIASES: [string, string][] = [
  ["saint genies des mourgues", "Saint-Geniès-des-Mourgues"],
  ["saint-jean-de-vedas", "Saint-Jean-de-Védas"],
  ["saint jean de vedas", "Saint-Jean-de-Védas"],
  ["st jean de vedas", "Saint-Jean-de-Védas"],
  ["murviel les montpellier", "Murviel-lès-Montpellier"],
  ["villeneuve les maguelone", "Villeneuve-lès-Maguelone"],
  ["montferrier sur lez", "Montferrier-sur-Lez"],
  ["saint georges d orques", "Saint-Georges-d'Orques"],
  ["castelnau le lez", "Castelnau-le-Lez"],
  ["castelnau-le-lez", "Castelnau-le-Lez"],
  ["palavas les flots", "Palavas-les-Flots"],
  ["prades le lez", "Prades-le-Lez"],
  ["saint drezery", "Saint-Drézéry"],
  ["restinclieres", "Restinclières"],
  ["cournonterral", "Cournonterral"],
  ["castelnau", "Castelnau-le-Lez"],
  ["cournonsec", "Cournonsec"],
  ["perolles", "Pérols"],
  ["vendargues", "Vendargues"],
  ["baillargues", "Baillargues"],
  ["sussargues", "Sussargues"],
  ["fabregues", "Fabrègues"],
  ["laverune", "Lavérune"],
  ["juvignac", "Juvignac"],
  ["palavas", "Palavas-les-Flots"],
  ["clapiers", "Clapiers"],
  ["clapier", "Clapiers"],
  ["grabels", "Grabels"],
  ["castries", "Castries"],
  ["beaulieu", "Beaulieu"],
  ["saussan", "Saussan"],
  ["pignan", "Pignan"],
  ["lattes", "Lattes"],
  ["latte", "Lattes"],
  ["perols", "Pérols"],
  ["jacou", "Jacou"],
  ["le cres", "Le Crès"],
  ["saint bres", "Saint-Brès"],
  ["montpellier", "Montpellier"],
];

const MAJOR = [
  "Montpellier",
  "Lattes",
  "Pérols",
  "Castelnau-le-Lez",
  "Saint-Jean-de-Védas",
  "Clapiers",
  "Jacou",
  "Grabels",
  "Juvignac",
  "Le Crès",
  "Palavas-les-Flots",
  "Vendargues",
];

export function inMetropole(latitude: number, longitude: number) {
  return latitude > 43.49 && latitude < 43.76 && longitude > 3.66 && longitude < 4.08;
}

export async function geocodeMetropole(
  query: string,
  bias?: { latitude: number; longitude: number },
): Promise<GeoPoint> {
  const trimmed = query.trim();
  if (trimmed.length < 3) throw new Error("Indique une adresse plus précise.");
  const city = mentionedCommune(trimmed);
  const attempts = city
    ? [withCity(trimmed, city)]
    : [trimmed, `${trimmed}, Montpellier Méditerranée Métropole`, `${trimmed}, Hérault`];

  let pool = await firstInside(attempts);
  if (pool.length === 0 && !city) pool = await searchCommunes(trimmed);
  if (pool.length === 0) throw new Error("Adresse introuvable dans la métropole.");

  const hit = nearest(pool, bias ?? { latitude: 43.61, longitude: 3.88 });
  return {
    latitude: hit.latitude,
    longitude: hit.longitude,
    address: await readableAddress(hit.latitude, hit.longitude, trimmed),
  };
}

export async function readableAddress(latitude: number, longitude: number, fallback: string) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return fallback;
    const line = [place.streetNumber, place.street].filter(Boolean).join(" ");
    const city = place.city || place.district || place.subregion || "";
    return [line || place.name, city].filter(Boolean).join(", ") || fallback;
  } catch {
    return fallback;
  }
}

function mentionedCommune(query: string) {
  const folded = fold(query);
  const alias = [...ALIASES]
    .sort((left, right) => fold(right[0]).length - fold(left[0]).length)
    .find(([name]) => folded.includes(fold(name)));
  if (alias) return alias[1];
  return COMMUNES.find((name) => folded.includes(fold(name))) ?? null;
}

function withCity(query: string, city: string) {
  return fold(query).includes(fold(city)) ? query : `${query}, ${city}`;
}

async function firstInside(attempts: string[]) {
  for (const attempt of attempts) {
    const inside = await geocodeInside(attempt);
    if (inside.length > 0) return inside;
  }
  return [];
}

async function searchCommunes(query: string) {
  const batches = await Promise.all(MAJOR.map((city) => geocodeInside(`${query}, ${city}`)));
  return batches.flat();
}

async function geocodeInside(query: string) {
  try {
    const results = await Location.geocodeAsync(query);
    return results.filter((item) => inMetropole(item.latitude, item.longitude));
  } catch {
    return [];
  }
}

function nearest<T extends { latitude: number; longitude: number }>(
  points: T[],
  bias: { latitude: number; longitude: number },
) {
  return points.reduce((best, point) =>
    distance(point, bias) < distance(best, bias) ? point : best,
  );
}

function distance(
  left: { latitude: number; longitude: number },
  right: { latitude: number; longitude: number },
) {
  const lat = left.latitude - right.latitude;
  const lon = (left.longitude - right.longitude) * Math.cos((right.latitude * Math.PI) / 180);
  return lat * lat + lon * lon;
}

function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
