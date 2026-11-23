import { DarkTheme, ThemeProvider } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import AppTabs from "@/components/app-tabs";
import { LiveProvider } from "@/lib/live";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <ThemeProvider value={DarkTheme}>
      <LiveProvider>
        <StatusBar style="light" />
        <AppTabs />
      </LiveProvider>
    </ThemeProvider>
  );
}
