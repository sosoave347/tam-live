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
