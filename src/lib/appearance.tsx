import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { palettes, type Palette } from "@/constants/theme";

const STORAGE_KEY = "tam-live-appearance-v1";

export type AppearanceMode = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

type AppearanceValue = {
  mode: AppearanceMode;
  scheme: ColorScheme;
  palette: Palette;
  setMode: (mode: AppearanceMode) => void;
};

const AppearanceContext = createContext<AppearanceValue | null>(null);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<AppearanceMode>("light");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw === "light" || raw === "dark" || raw === "system") setModeState(raw);
      })
      .catch(() => undefined);
  }, []);

  const setMode = useCallback((next: AppearanceMode) => {
    setModeState(next);
    AsyncStorage.setItem(STORAGE_KEY, next).catch(() => undefined);
  }, []);

  const scheme: ColorScheme = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const palette = palettes[scheme];
  const value = useMemo(() => ({ mode, scheme, palette, setMode }), [mode, scheme, palette, setMode]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export function useAppearance() {
  const value = useContext(AppearanceContext);
  if (!value) throw new Error("useAppearance doit être utilisé dans AppearanceProvider");
  return value;
}

export function usePalette() {
  return useAppearance().palette;
}

export function useStyles<T>(factory: (palette: Palette) => T): T {
  const palette = usePalette();
  return useMemo(() => factory(palette), [factory, palette]);
}
