const VEHICLE_POSITIONS_URL = "https://gtfsproxy.e-tam.fr/COMMON/VehiclePosition.pb";

export type LiveVehicle = {
  id: string;
  label: string;
  routeId: string;
  tripId?: string;
  directionId?: number;
  latitude: number;
  longitude: number;
  bearing?: number;
  speedMps?: number;
  timestamp?: number;
};

export type VehicleFeed = {
  timestamp?: number;
  vehicles: LiveVehicle[];
};

type Field = {
  num: number;
  wire: number;
  varint?: bigint;
  data: Uint8Array;
};

function readVarint(buf: Uint8Array, offset: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  let pos = offset;
  while (pos < buf.length && shift <= 63n) {
    const byte = buf[pos++];
    result |= BigInt(byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) return [result, pos];
    shift += 7n;
  }
  throw new Error("Flux GTFS-RT tronqué");
}

function walk(buf: Uint8Array, visit: (field: Field) => void) {
  let offset = 0;
  while (offset < buf.length) {
    const [key, afterKey] = readVarint(buf, offset);
    offset = afterKey;
    const wire = Number(key & 7n);
    const num = Number(key >> 3n);
    if (wire === 0) {
      const [value, next] = readVarint(buf, offset);
      visit({ num, wire, varint: value, data: buf.subarray(offset, next) });
      offset = next;
    } else if (wire === 1) {
      visit({ num, wire, data: buf.subarray(offset, offset + 8) });
      offset += 8;
    } else if (wire === 2) {
      const [length, start] = readVarint(buf, offset);
      const end = start + Number(length);
      visit({ num, wire, data: buf.subarray(start, end) });
      offset = end;
    } else if (wire === 5) {
      visit({ num, wire, data: buf.subarray(offset, offset + 4) });
      offset += 4;
    } else {
      throw new Error(`Type protobuf inattendu (${wire})`);
    }
  }
}

function text(data: Uint8Array) {
  return new TextDecoder().decode(data);
}

function float32(data: Uint8Array) {
  return new DataView(data.buffer, data.byteOffset, 4).getFloat32(0, true);
}

function uint(value: bigint | undefined) {
  return value == null ? undefined : Number(value);
}

function decodePosition(buf: Uint8Array) {
  const position: { latitude?: number; longitude?: number; bearing?: number; speedMps?: number } = {};
  walk(buf, (field) => {
    if (field.wire !== 5) return;
    const value = float32(field.data);
    if (field.num === 1) position.latitude = value;
    if (field.num === 2) position.longitude = value;
    if (field.num === 3) position.bearing = value;
    if (field.num === 5) position.speedMps = value;
  });
  return position;
}

function decodeTrip(buf: Uint8Array) {
  const trip: { tripId?: string; routeId?: string; directionId?: number } = {};
  walk(buf, (field) => {
    if (field.num === 1 && field.wire === 2) trip.tripId = text(field.data);
    if (field.num === 5 && field.wire === 2) trip.routeId = text(field.data);
    if (field.num === 6 && field.wire === 0) trip.directionId = uint(field.varint);
  });
  return trip;
}

function decodeDescriptor(buf: Uint8Array) {
  const descriptor: { id?: string; label?: string } = {};
  walk(buf, (field) => {
    if (field.wire !== 2) return;
    if (field.num === 1) descriptor.id = text(field.data);
    if (field.num === 2) descriptor.label = text(field.data);
  });
  return descriptor;
}

function decodeVehicle(buf: Uint8Array, entityId: string): LiveVehicle | null {
  const vehicle: Partial<LiveVehicle> = { id: entityId, label: entityId };
  walk(buf, (field) => {
    if (field.wire !== 2 && field.num !== 5) return;
    if (field.num === 1 && field.wire === 2) {
      const trip = decodeTrip(field.data);
      vehicle.tripId = trip.tripId;
      vehicle.routeId = trip.routeId;
      vehicle.directionId = trip.directionId;
    } else if (field.num === 2 && field.wire === 2) {
      const position = decodePosition(field.data);
      vehicle.latitude = position.latitude;
      vehicle.longitude = position.longitude;
      vehicle.bearing = position.bearing;
      vehicle.speedMps = position.speedMps;
    } else if (field.num === 5 && field.wire === 0) {
      vehicle.timestamp = uint(field.varint);
    } else if (field.num === 8 && field.wire === 2) {
      const descriptor = decodeDescriptor(field.data);
      if (descriptor.id) vehicle.id = descriptor.id;
      if (descriptor.label) vehicle.label = descriptor.label;
    }
  });

  const { latitude, longitude } = vehicle;
  if (latitude == null || longitude == null) return null;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) < 1 || Math.abs(longitude) < 1) return null;

  return {
    id: vehicle.id || entityId,
    label: vehicle.label || vehicle.id || entityId,
    routeId: vehicle.routeId || "",
    tripId: vehicle.tripId,
    directionId: vehicle.directionId,
    latitude,
    longitude,
    bearing: vehicle.bearing,
    speedMps: vehicle.speedMps,
    timestamp: vehicle.timestamp,
  };
}

export function decodeVehicleFeed(buffer: Uint8Array): VehicleFeed {
  let timestamp: number | undefined;
  const vehicles: LiveVehicle[] = [];

  walk(buffer, (field) => {
    if (field.num === 1 && field.wire === 2) {
      walk(field.data, (header) => {
        if (header.num === 3 && header.wire === 0) timestamp = uint(header.varint);
      });
    }
    if (field.num === 2 && field.wire === 2) {
      let entityId = "";
      let deleted = false;
      let vehicle: LiveVehicle | null = null;
      walk(field.data, (entity) => {
        if (entity.num === 1 && entity.wire === 2) entityId = text(entity.data);
        if (entity.num === 2 && entity.wire === 0) deleted = entity.varint === 1n;
        if (entity.num === 4 && entity.wire === 2) vehicle = decodeVehicle(entity.data, entityId);
      });
      if (!deleted && vehicle) vehicles.push(vehicle);
    }
  });

  return { timestamp, vehicles };
}

const TRIP_UPDATES_URL = "https://gtfsproxy.e-tam.fr/COMMON/TripUpdate.pb";
const ALERTS_URL = "https://gtfsproxy.e-tam.fr/COMMON/Alert.pb";

export type LiveTrip = {
  routeId: string;
  directionId?: number;
  passes: { stopId: string; time: number }[];
};

export type ServiceAlert = {
  id: string;
  effect?: number;
  header: string;
  description: string;
  routeIds: string[];
};

export const ALERT_LABELS: Record<number, string> = {
  1: "Interruption",
  2: "Service réduit",
  3: "Retards importants",
  4: "Déviation",
  5: "Service supplémentaire",
  6: "Service modifié",
  7: "Perturbation",
  8: "Perturbation",
  9: "Arrêt déplacé",
  10: "Information",
  11: "Accessibilité",
};

function translation(buffer: Uint8Array) {
  let fallback = "";
  let french = "";
  walk(buffer, (field) => {
    if (field.num !== 1 || field.wire !== 2) return;
    let value = "";
    let language = "";
    walk(field.data, (part) => {
      if (part.num === 1 && part.wire === 2) value = text(part.data);
      if (part.num === 2 && part.wire === 2) language = text(part.data).toLowerCase();
    });
    if (!fallback) fallback = value;
    if (language.startsWith("fr")) french = value;
  });
  return (french || fallback).trim();
}

function decodeStopPass(buffer: Uint8Array) {
  let stopId = "";
  let time: number | undefined;
  let skipped = false;
  walk(buffer, (field) => {
    if (field.num === 4 && field.wire === 2) stopId = text(field.data);
    if (field.num === 5 && field.wire === 0) skipped = field.varint === 1n;
    if ((field.num === 2 || field.num === 3) && field.wire === 2) {
      let eventTime: number | undefined;
      walk(field.data, (event) => {
        if (event.num === 2 && event.wire === 0) eventTime = uint(event.varint);
      });
      if (eventTime != null && (field.num === 3 || time == null)) time = eventTime;
    }
  });
  if (skipped || !stopId || time == null) return null;
  return { stopId, time };
}

export function decodeTripFeed(buffer: Uint8Array, nowSeconds = Date.now() / 1000): LiveTrip[] {
  const horizon = nowSeconds + 3 * 60 * 60;
  const trips: LiveTrip[] = [];
  walk(buffer, (field) => {
    if (field.num !== 2 || field.wire !== 2) return;
    let update: Uint8Array | null = null;
    walk(field.data, (entity) => {
      if (entity.num === 3 && entity.wire === 2) update = entity.data;
    });
    if (!update) return;
    let routeId = "";
    let directionId: number | undefined;
    let canceled = false;
    const passes: { stopId: string; time: number }[] = [];
    walk(update, (part) => {
      if (part.num === 1 && part.wire === 2) {
        const trip = decodeTrip(part.data);
        routeId = trip.routeId ?? "";
        directionId = trip.directionId;
        walk(part.data, (tripField) => {
          if (tripField.num === 4 && tripField.wire === 0 && tripField.varint === 3n) canceled = true;
        });
      }
      if (part.num === 2 && part.wire === 2) {
        const pass = decodeStopPass(part.data);
        if (pass && pass.time >= nowSeconds - 30 && pass.time <= horizon) passes.push(pass);
      }
    });
    if (canceled || !routeId || passes.length === 0) return;
    passes.sort((a, b) => a.time - b.time);
    trips.push({ routeId, directionId, passes });
  });
  return trips;
}

function activeAlert(buffer: Uint8Array, nowSeconds: number) {
  const ranges: { start?: number; end?: number }[] = [];
  walk(buffer, (field) => {
    if (field.num !== 1 || field.wire !== 2) return;
    const range: { start?: number; end?: number } = {};
    walk(field.data, (part) => {
      if (part.num === 1 && part.wire === 0) range.start = uint(part.varint);
      if (part.num === 2 && part.wire === 0) range.end = uint(part.varint);
    });
    ranges.push(range);
  });
  if (ranges.length === 0) return true;
  return ranges.some((range) => {
    if (range.start != null && nowSeconds < range.start) return false;
    if (range.end != null && nowSeconds > range.end) return false;
    return true;
  });
}

export function decodeAlertFeed(buffer: Uint8Array, nowSeconds = Date.now() / 1000): ServiceAlert[] {
  const alerts: ServiceAlert[] = [];
  walk(buffer, (field) => {
    if (field.num !== 2 || field.wire !== 2) return;
    let id = "";
    let message: Uint8Array | null = null;
    walk(field.data, (entity) => {
      if (entity.num === 1 && entity.wire === 2) id = text(entity.data);
      if (entity.num === 5 && entity.wire === 2) message = entity.data;
    });
    if (!message || !activeAlert(message, nowSeconds)) return;
    let effect: number | undefined;
    let header = "";
    let description = "";
    const routeIds: string[] = [];
    walk(message, (part) => {
      if (part.num === 5 && part.wire === 2) {
        walk(part.data, (selector) => {
          if (selector.num === 2 && selector.wire === 2) routeIds.push(text(selector.data));
        });
      }
      if (part.num === 7 && part.wire === 0) effect = uint(part.varint);
      if (part.num === 10 && part.wire === 2) header = translation(part.data);
      if (part.num === 11 && part.wire === 2) description = translation(part.data);
    });
    if (!header && !description) return;
    alerts.push({
      id: id || header,
      effect,
      header: header || ALERT_LABELS[effect ?? 7] || "Alerte",
      description,
      routeIds,
    });
  });
  return alerts;
}

async function fetchProtobuf(url: string, signal?: AbortSignal) {
  const response = await fetch(url, { signal, headers: { Accept: "application/x-protobuf" } });
  if (!response.ok) throw new Error(`Flux TaM indisponible (${response.status})`);
  return new Uint8Array(await response.arrayBuffer());
}

export function fetchTripFeed(signal?: AbortSignal) {
  return fetchProtobuf(TRIP_UPDATES_URL, signal).then((buffer) => decodeTripFeed(buffer));
}

export function fetchAlertFeed(signal?: AbortSignal) {
  return fetchProtobuf(ALERTS_URL, signal).then((buffer) => decodeAlertFeed(buffer));
}

export async function fetchVehicleFeed(signal?: AbortSignal): Promise<VehicleFeed> {
  const response = await fetch(VEHICLE_POSITIONS_URL, {
    signal,
    headers: { Accept: "application/x-protobuf" },
  });
  if (!response.ok) {
    throw new Error(`Flux TaM indisponible (${response.status})`);
  }
  return decodeVehicleFeed(new Uint8Array(await response.arrayBuffer()));
}
