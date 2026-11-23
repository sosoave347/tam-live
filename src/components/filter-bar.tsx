import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { cardShadow, type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { formatClock } from "@/lib/format";
import { useLive } from "@/lib/live";
import { routeFor, routes, type RouteMode } from "@/lib/network";

const MODES: { id: "all" | RouteMode; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "tram", label: "Trams" },
  { id: "bus", label: "Bus" },
];

export function FilterBar() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { filter, setFilter, setSelectedId, vehicles, visible, loading, error, updatedAt } = useLive();
  const trams = routes.filter((route) => route.mode === "tram");
  const selectedRoute = routes.find((route) => route.id === filter.routeId);
  const tramCount = vehicles.filter((vehicle) => routeFor(vehicle.routeId)?.mode === "tram").length;
  const busCount = vehicles.filter((vehicle) => routeFor(vehicle.routeId)?.mode === "bus").length;

  function selectMode(mode: "all" | RouteMode) {
    setSelectedId(null);
    setFilter({ mode, routeId: null });
  }

  function selectRoute(routeId: string, mode: RouteMode) {
    setSelectedId(null);
    setFilter(filter.routeId === routeId ? { mode: "all", routeId: null } : { mode, routeId });
  }

  return (
    <View style={styles.wrap}>
      <Pressable style={styles.amigo} onPress={() => router.push("/amigo")}>
        <View style={styles.amigoMark}>
          <Text style={styles.amigoMarkText}>A</Text>
        </View>
        <View style={styles.amigoCopy}>
          <Text style={styles.title}>Amigo</Text>
          <Text style={styles.kicker}>Où veux-tu aller ?</Text>
        </View>
        <View style={styles.stats}>
          <Text style={styles.statValue}>{loading && vehicles.length === 0 ? "…" : visible.length}</Text>
          <Text style={styles.statLabel}>en ligne</Text>
        </View>
      </Pressable>

      <View style={styles.modes}>
        {MODES.map((mode) => {
          const active = filter.mode === mode.id && !filter.routeId;
          return (
            <Pressable
              key={mode.id}
              onPress={() => selectMode(mode.id)}
              style={[styles.mode, active && styles.modeActive]}>
              <Text style={[styles.modeText, active && styles.modeTextActive]}>{mode.label}</Text>
            </Pressable>
          );
        })}
        <Text style={styles.mix}>
          {tramCount} trams · {busCount} bus
        </Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.lines}>
        {trams.map((route) => {
          const active = filter.routeId === route.id;
          return (
            <Pressable
              key={route.id}
              onPress={() => selectRoute(route.id, "tram")}
              style={[styles.line, { backgroundColor: route.color }, active && styles.lineActive]}>
              <Text style={[styles.lineText, { color: route.textColor }]}>{route.shortName}</Text>
            </Pressable>
          );
        })}
        {selectedRoute?.mode === "bus" ? (
          <Pressable
            onPress={() => setFilter({ mode: "all", routeId: null })}
            style={[styles.line, styles.busLine, { backgroundColor: selectedRoute.color }]}>
            <Text style={[styles.lineText, { color: selectedRoute.textColor }]}>
              {selectedRoute.shortName} ×
            </Text>
          </Pressable>
        ) : null}
      </ScrollView>

      <Text style={[styles.status, error && styles.statusError]}>
        {error
          ? error
          : updatedAt
            ? `Synchronisé à ${formatClock(updatedAt)}`
            : "Connexion au flux TaM…"}
      </Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: palette.panel,
    gap: 10,
    ...cardShadow,
  },
  amigo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  amigoMark: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.blue,
    alignItems: "center",
    justifyContent: "center",
  },
  amigoMarkText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },
  amigoCopy: {
    flex: 1,
  },
  kicker: {
    color: palette.muted,
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "700",
  },
  stats: {
    alignItems: "center",
  },
  statValue: {
    color: palette.text,
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    color: palette.muted,
    fontSize: 12,
  },
  modes: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  mode: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: palette.fill,
  },
  modeActive: {
    backgroundColor: palette.blue,
  },
  modeText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: "600",
  },
  modeTextActive: {
    color: "#FFFFFF",
  },
  mix: {
    marginLeft: "auto",
    color: palette.muted,
    fontSize: 12,
  },
  lines: {
    gap: 8,
    paddingRight: 8,
  },
  line: {
    minWidth: 36,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  lineActive: {
    borderWidth: 2,
    borderColor: palette.ink,
  },
  busLine: {
    paddingHorizontal: 12,
  },
  lineText: {
    fontWeight: "800",
    fontSize: 15,
  },
  status: {
    color: palette.muted,
    fontSize: 12,
  },
  statusError: {
    color: palette.danger,
  },
  });
}
