export function formatClock(epochMs: number) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Paris",
  }).format(epochMs);
}

export function formatAge(timestamp?: number, now = Date.now()) {
  if (!timestamp) return "heure inconnue";
  const seconds = Math.round(now / 1000 - timestamp);
  if (seconds < 15) return "à l'instant";
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  return `il y a ${Math.round(minutes / 60)} h`;
}

export function isStale(timestamp?: number, now = Date.now()) {
  if (!timestamp) return false;
  return now / 1000 - timestamp > 180;
}

/** The TaM feed sometimes publishes impossible speeds. Hide those. */
export function formatSpeed(speedMps?: number) {
  if (speedMps == null || !Number.isFinite(speedMps) || speedMps < 0.4) return null;
  const kmh = speedMps * 3.6;
  if (kmh > 110) return null;
  return `${Math.round(kmh)} km/h`;
}
