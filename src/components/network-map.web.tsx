import { FlatList, StyleSheet, Text, View } from "react-native";

import { palette } from "@/constants/theme";
import { formatAge, formatSpeed } from "@/lib/format";
import { useLive } from "@/lib/live";
import { modeLabel, routeFor } from "@/lib/network";

export function NetworkMap() {
  const { visible, loading, error } = useLive();

  return (
    <View style={styles.fill}>
      <Text style={styles.notice}>
        La carte interactive est prévue pour Expo Go. Cette vue liste le même flux temps réel.
      </Text>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={visible}
        keyExtractor={(vehicle) => vehicle.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>{loading ? "Connexion au flux TaM…" : "Aucun véhicule affiché."}</Text>
        }
        renderItem={({ item }) => {
          const route = routeFor(item.routeId);
          const speed = formatSpeed(item.speedMps);
          return (
            <View style={styles.row}>
              <View style={[styles.badge, { backgroundColor: route?.color ?? palette.muted }]}>
                <Text style={{ color: route?.textColor ?? "#fff", fontWeight: "800" }}>
                  {route?.shortName ?? "?"}
                </Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.title}>
                  {route ? `${modeLabel(route.mode)} ${route.shortName}` : item.routeId} · {item.label}
                </Text>
                <Text style={styles.meta}>
                  {formatAge(item.timestamp)}
                  {speed ? ` · ${speed}` : ""}
                </Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: palette.bg },
  notice: { color: palette.muted, padding: 16, paddingBottom: 0 },
  error: { color: palette.danger, paddingHorizontal: 16, paddingTop: 8 },
  list: { padding: 16, gap: 8 },
  empty: { color: palette.muted, paddingTop: 24 },
  row: { flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 6 },
  badge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  copy: { flex: 1 },
  title: { color: palette.text, fontWeight: "700" },
  meta: { color: palette.muted, fontSize: 12 },
});
