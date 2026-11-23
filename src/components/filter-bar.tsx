import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { useFavorites } from "@/lib/favorites";
import { useLive, type VehicleFilter } from "@/lib/live";
import { routes } from "@/lib/network";

const MODES: { id: VehicleFilter["mode"]; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "tram", label: "Tram" },
  { id: "bus", label: "Bus" },
];

export function FilterBar() {
  const styles = useStyles(createStyles);
  const { filter, setFilter, setSelectedId } = useLive();
  const { ids } = useFavorites();
  const trams = routes.filter((route) => route.mode === "tram");
  const shown = filter.mode === "saved" ? trams.filter((route) => ids.includes(route.id)) : trams;
  const selectedBus = routes.find((route) => route.id === filter.routeId && route.mode === "bus");

  function selectMode(mode: VehicleFilter["mode"]) {
    setSelectedId(null);
    setFilter({ mode, routeId: null });
  }

  function selectRoute(routeId: string, mode: VehicleFilter["mode"]) {
    setSelectedId(null);
    setFilter(filter.routeId === routeId ? { mode, routeId: null } : { mode, routeId });
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} style={styles.wrap}>
      {MODES.map((mode) => {
        const active = filter.mode === mode.id && !filter.routeId;
        return (
          <Pressable key={mode.id} onPress={() => selectMode(mode.id)} style={[styles.mode, active && styles.modeActive]}>
            <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
          </Pressable>
        );
      })}
      {ids.length > 0 ? (
        <Pressable onPress={() => selectMode("saved")} style={[styles.mode, filter.mode === "saved" && !filter.routeId && styles.modeActive]}>
          <Text style={[styles.modeText, filter.mode === "saved" && !filter.routeId && styles.modeTextActive]}>Mes</Text>
        </Pressable>
      ) : null}
      {shown.map((route) => {
        const active = filter.routeId === route.id;
        return (
          <Pressable
            key={route.id}
            onPress={() => selectRoute(route.id, filter.mode === "saved" ? "saved" : "tram")}
            style={[styles.line, { backgroundColor: route.color }, active && styles.lineActive]}>
            <Text style={[styles.lineText, { color: route.textColor }]}>{route.shortName}</Text>
          </Pressable>
        );
      })}
      {selectedBus ? (
        <Pressable
          onPress={() => selectMode("all")}
          style={[styles.line, { backgroundColor: selectedBus.color }, styles.lineActive]}>
          <Text style={[styles.lineText, { color: selectedBus.textColor }]}>{selectedBus.shortName}</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    wrap: {
      marginHorizontal: 10,
      marginTop: 6,
      flexGrow: 0,
    },
    row: {
      alignItems: "center",
      gap: 6,
      paddingRight: 8,
    },
    mode: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: palette.panel,
    },
    modeActive: {
      backgroundColor: palette.blue,
    },
    modeText: {
      color: palette.text,
      fontSize: 12,
      fontWeight: "700",
    },
    modeTextActive: {
      color: "#FFFFFF",
    },
    line: {
      minWidth: 28,
      height: 28,
      paddingHorizontal: 7,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    lineActive: {
      borderWidth: 2,
      borderColor: palette.ink,
    },
    lineText: {
      fontWeight: "800",
      fontSize: 13,
    },
  });
}
