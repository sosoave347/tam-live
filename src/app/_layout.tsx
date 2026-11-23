import { DarkTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import AppTabs from "@/components/app-tabs";
import { LiveProvider } from "@/lib/live";
import { LocationProvider } from "@/lib/location";
import { PlacesProvider } from "@/lib/places";
import { ServiceProvider } from "@/lib/service";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <PlacesProvider>
        <LocationProvider>
          <LiveProvider>
            <ServiceProvider>
              <StatusBar style="light" />
              <AppTabs />
            </ServiceProvider>
          </LiveProvider>
        </LocationProvider>
      </PlacesProvider>
    </ThemeProvider>
  );
}
