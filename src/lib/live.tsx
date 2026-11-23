import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState } from "react-native";

import { fetchVehicleFeed, type LiveVehicle } from "@/lib/gtfs-rt";
import { routeFor, type RouteMode } from "@/lib/network";

const POLL_MS = 10_000;

export type VehicleFilter = {
  mode: "all" | RouteMode;
  routeId: string | null;
};

type LiveContextValue = {
  vehicles: LiveVehicle[];
  visible: LiveVehicle[];
  counts: Map<string, number>;
  filter: VehicleFilter;
  setFilter: (filter: VehicleFilter) => void;
  selectedId: string | null;
  setSelectedId: (id: string | null) => void;
  selected: LiveVehicle | null;
  loading: boolean;
  error: string | null;
  updatedAt: number | null;
  feedTimestamp?: number;
  refresh: () => Promise<void>;
};

const LiveContext = createContext<LiveContextValue | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [vehicles, setVehicles] = useState<LiveVehicle[]>([]);
  const [filter, setFilter] = useState<VehicleFilter>({ mode: "all", routeId: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [feedTimestamp, setFeedTimestamp] = useState<number | undefined>();
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12_000);
    try {
      const feed = await fetchVehicleFeed(controller.signal);
      setVehicles(feed.vehicles);
      setFeedTimestamp(feed.timestamp);
      setUpdatedAt(Date.now());
      setError(null);
    } catch (caught) {
      const aborted = caught instanceof Error && caught.name === "AbortError";
      const message = aborted
        ? "Le flux TaM ne répond pas"
        : caught instanceof Error
          ? caught.message
          : "Flux TaM indisponible";
      setError(message);
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  const visible = useMemo(
    () =>
      vehicles.filter((vehicle) => {
        if (filter.routeId && vehicle.routeId !== filter.routeId) return false;
        if (filter.mode === "all") return true;
        return routeFor(vehicle.routeId)?.mode === filter.mode;
      }),
    [vehicles, filter],
  );

  const counts = useMemo(() => {
    const next = new Map<string, number>();
    for (const vehicle of vehicles) {
      if (!vehicle.routeId) continue;
      next.set(vehicle.routeId, (next.get(vehicle.routeId) ?? 0) + 1);
    }
    return next;
  }, [vehicles]);

  const selected = useMemo(
    () => vehicles.find((vehicle) => vehicle.id === selectedId) ?? null,
    [vehicles, selectedId],
  );

  const value = useMemo(
    () => ({
      vehicles,
      visible,
      counts,
      filter,
      setFilter,
      selectedId,
      setSelectedId,
      selected,
      loading,
      error,
      updatedAt,
      feedTimestamp,
      refresh,
    }),
    [vehicles, visible, counts, filter, selectedId, selected, loading, error, updatedAt, feedTimestamp, refresh],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const value = useContext(LiveContext);
  if (!value) throw new Error("useLive doit être utilisé dans LiveProvider");
  return value;
}
