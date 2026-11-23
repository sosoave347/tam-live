import * as Location from "expo-location";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

type Coordinates = {
  latitude: number;
  longitude: number;
};

type LocationContextValue = {
  coords: Coordinates | null;
  granted: boolean;
  request: () => Promise<boolean>;
};

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [coords, setCoords] = useState<Coordinates | null>(null);
  const [granted, setGranted] = useState(false);
  const watch = useRef<Location.LocationSubscription | null>(null);

  const start = useCallback(async () => {
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    watch.current?.remove();
    watch.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 30, timeInterval: 15000 },
      (next) => setCoords({ latitude: next.coords.latitude, longitude: next.coords.longitude }),
    );
  }, []);

  useEffect(() => {
    let alive = true;
    Location.getForegroundPermissionsAsync().then(async (current) => {
      if (!alive || current.status !== "granted") return;
      setGranted(true);
      await start();
    });
    return () => {
      alive = false;
      watch.current?.remove();
    };
  }, [start]);

  const request = useCallback(async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    const allowed = permission.status === "granted";
    setGranted(allowed);
    if (allowed) await start();
    return allowed;
  }, [start]);

  const value = useMemo(() => ({ coords, granted, request }), [coords, granted, request]);
  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useUserLocation() {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useUserLocation doit être utilisé dans LocationProvider");
  return value;
}
