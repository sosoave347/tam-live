import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { cardShadow, type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { useFavorites } from "@/lib/favorites";
import { useLive, type VehicleFilter } from "@/lib/live";
import { routes } from "@/lib/network";

const MODES: { id: VehicleFilter["mode"]; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "tram", label: "Tram" },
  { id: "bus", label: "Bus" },
];

export function FilterBar({
  onMe,
  onNetwork,
  onClear,
}: {
  onMe: () => void;
  onNetwork: () => void;
  onClear?: () => void;
}) {
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
    <View style={styles.card}>
      <View style={styles.actions}>
        <Pressable style={styles.action} onPress={onMe}>
          <Text style={styles.actionText}>Moi</Text>
        </Pressable>
        <Pressable style={styles.action} onPress={onNetwork}>
          <Text style={styles.actionText}>Réseau</Text>
        </Pressable>
        {onClear ? (
          <Pressable style={styles.action} onPress={onClear}>
            <Text style={styles.actionText}>Effacer</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
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
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      marginHorizontal: 12,
      marginTop: 8,
      paddingHorizontal: 10,
      paddingVertical: 10,
      borderRadius: 22,
      backgroundColor: palette.panel,
      gap: 8,
      ...cardShadow,
    },
    actions: {
      flexDirection: "row",
      gap: 6,
    },
    action: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: palette.fill,
    },
    actionText: {
      color: palette.text,
      fontSize: 13,
      fontWeight: "700",
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
      backgroundColor: palette.fill,
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
