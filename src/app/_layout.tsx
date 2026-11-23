import { DefaultTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import AppTabs from "@/components/app-tabs";
import { JourneyProvider } from "@/lib/journey";
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
    <ThemeProvider value={DefaultTheme}>
      <PlacesProvider>
        <LocationProvider>
          <JourneyProvider>
            <LiveProvider>
              <ServiceProvider>
                <StatusBar style="dark" />
                <AppTabs />
              </ServiceProvider>
            </LiveProvider>
          </JourneyProvider>
        </LocationProvider>
      </PlacesProvider>
    </ThemeProvider>
  );
}
