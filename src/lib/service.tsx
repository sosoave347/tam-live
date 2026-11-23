import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { fetchAlertFeed, fetchTripFeed, type LiveTrip, type ServiceAlert } from "@/lib/gtfs-rt";

const POLL_MS = 20_000;

type ServiceContextValue = {
  trips: LiveTrip[];
  alerts: ServiceAlert[];
  updatedAt: number | null;
  refresh: () => Promise<void>;
};

const ServiceContext = createContext<ServiceContextValue | null>(null);

export function ServiceProvider({ children }: { children: ReactNode }) {
  const [trips, setTrips] = useState<LiveTrip[]>([]);
  const [alerts, setAlerts] = useState<ServiceAlert[]>([]);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    const [nextTrips, nextAlerts] = await Promise.all([
      fetchTripFeed().catch(() => null),
      fetchAlertFeed().catch(() => null),
    ]);
    if (nextTrips) setTrips(nextTrips);
    if (nextAlerts) setAlerts(nextAlerts);
    if (nextTrips || nextAlerts) setUpdatedAt(Date.now());
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

  const value = useMemo(() => ({ trips, alerts, updatedAt, refresh }), [trips, alerts, updatedAt, refresh]);
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
}

export function useService() {
  const value = useContext(ServiceContext);
  if (!value) throw new Error("useService doit être utilisé dans ServiceProvider");
  return value;
}
