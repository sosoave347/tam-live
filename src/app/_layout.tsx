import { DarkTheme, DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import AppTabs from "@/components/app-tabs";
import { AppearanceProvider, useAppearance } from "@/lib/appearance";
import { FavoritesProvider } from "@/lib/favorites";
import { JourneyProvider } from "@/lib/journey";
import { LiveProvider } from "@/lib/live";
import { LocationProvider } from "@/lib/location";
import { PickProvider } from "@/lib/pick";
import { PlacesProvider } from "@/lib/places";
import { ServiceProvider } from "@/lib/service";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <AppearanceProvider>
      <PlacesProvider>
        <LocationProvider>
          <PickProvider>
            <JourneyProvider>
              <FavoritesProvider>
              <LiveProvider>
                <ServiceProvider>
                  <ThemedShell />
                </ServiceProvider>
              </LiveProvider>
              </FavoritesProvider>
            </JourneyProvider>
          </PickProvider>
        </LocationProvider>
      </PlacesProvider>
    </AppearanceProvider>
  );
}

function ThemedShell() {
  const { scheme } = useAppearance();
  return (
    <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <AppTabs />
    </ThemeProvider>
  );
}
