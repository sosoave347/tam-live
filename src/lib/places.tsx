import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "tam-live-places-v1";

export type SavedPlace = {
  address: string;
  latitude: number;
  longitude: number;
};

type Places = {
  home: SavedPlace | null;
  work: SavedPlace | null;
};

type Focus = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

type PlacesContextValue = Places & {
  ready: boolean;
  focus: Focus | null;
  saveAddress: (kind: keyof Places, query: string) => Promise<void>;
  saveHere: (kind: keyof Places) => Promise<void>;
  clearPlace: (kind: keyof Places) => void;
  focusOn: (latitude: number, longitude: number) => void;
  clearFocus: () => void;
};

const PlacesContext = createContext<PlacesContextValue | null>(null);

const EMPTY: Places = { home: null, work: null };

export function PlacesProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<Places>(EMPTY);
  const [ready, setReady] = useState(false);
  const [focus, setFocus] = useState<Focus | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Places>;
        setPlaces({ home: parsed.home ?? null, work: parsed.work ?? null });
      })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Places) => {
    setPlaces(next);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => undefined);
  }, []);

  const saveAddress = useCallback(
    async (kind: keyof Places, query: string) => {
      const trimmed = query.trim();
      if (trimmed.length < 3) throw new Error("Indique une adresse plus précise.");
      const biased = /montpellier/i.test(trimmed) ? trimmed : `${trimmed}, Montpellier`;
      const results = await Location.geocodeAsync(biased);
      const hit = results.find((item) => inMetropole(item.latitude, item.longitude)) ?? results[0];
      if (!hit) throw new Error("Adresse introuvable autour de Montpellier.");
      const address = await readableAddress(hit.latitude, hit.longitude, trimmed);
      persist({ ...places, [kind]: { address, latitude: hit.latitude, longitude: hit.longitude } });
    },
    [persist, places],
  );

  const saveHere = useCallback(
    async (kind: keyof Places) => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") throw new Error("La position est nécessaire pour enregistrer ce lieu.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const address = await readableAddress(latitude, longitude, "Position actuelle");
      persist({ ...places, [kind]: { address, latitude, longitude } });
    },
    [persist, places],
  );

  const clearPlace = useCallback(
    (kind: keyof Places) => persist({ ...places, [kind]: null }),
    [persist, places],
  );

  const focusOn = useCallback((latitude: number, longitude: number) => {
    setFocus({ latitude, longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 });
  }, []);

  const value = useMemo(
    () => ({
      ...places,
      ready,
      focus,
      saveAddress,
      saveHere,
      clearPlace,
      focusOn,
      clearFocus: () => setFocus(null),
    }),
    [places, ready, focus, saveAddress, saveHere, clearPlace, focusOn],
  );

  return <PlacesContext.Provider value={value}>{children}</PlacesContext.Provider>;
}

export function usePlaces() {
  const value = useContext(PlacesContext);
  if (!value) throw new Error("usePlaces doit être utilisé dans PlacesProvider");
  return value;
}

async function readableAddress(latitude: number, longitude: number, fallback: string) {
  try {
    const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!place) return fallback;
    const line = [place.streetNumber, place.street].filter(Boolean).join(" ");
    const city = place.city || place.district || "Montpellier";
    return [line || place.name, city].filter(Boolean).join(", ") || fallback;
  } catch {
    return fallback;
  }
}

function inMetropole(latitude: number, longitude: number) {
  return latitude > 43.45 && latitude < 43.78 && longitude > 3.62 && longitude < 4.08;
}
