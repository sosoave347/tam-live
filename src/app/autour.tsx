import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { arrivalsNear, formatDistance, formatWait } from "@/lib/commute";
import { useUserLocation } from "@/lib/location";
import { useService } from "@/lib/service";
import { walkMinutes } from "@/lib/stops";

export default function AroundScreen() {
  const styles = useStyles(createStyles);
  const { coords, granted, request } = useUserLocation();
  const { trips, alerts } = useService();
  const nearby = coords ? arrivalsNear(coords, trips, alerts) : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Autour de toi</Text>
        <Text style={styles.meta}>Dans un rayon d'un kilomètre.</Text>
        {!granted ? (
          <Pressable style={styles.button} onPress={request}>
            <Text style={styles.buttonText}>Activer la position</Text>
          </Pressable>
        ) : !coords ? (
          <Text style={styles.meta}>Position en cours…</Text>
        ) : nearby.length === 0 ? (
          <Text style={styles.meta}>Aucun arrêt à proximité.</Text>
        ) : (
          nearby.map(({ cluster, next }) => (
            <View key={cluster.ids[0]} style={styles.card}>
              <View style={styles.head}>
                <Text style={styles.name}>{cluster.name}</Text>
                <Text style={styles.meta}>
                  {formatDistance(cluster.distance)} · {walkMinutes(cluster.distance)} min
                </Text>
              </View>
              {next.length === 0 ? (
                <Text style={styles.meta}>Pas de passage</Text>
              ) : (
                next.map((arrival) => (
                  <View key={`${cluster.ids[0]}-${arrival.routeId}`} style={styles.row}>
                    <View style={[styles.badge, { backgroundColor: arrival.color }]}>
                      <Text style={[styles.badgeText, { color: arrival.textColor }]}>{arrival.shortName}</Text>
                    </View>
                    <Text style={styles.detail} numberOfLines={1}>
                      {arrival.destination ?? (arrival.mode === "tram" ? "Tram" : "Bus")}
                      {arrival.disrupted ? " · alerte" : ""}
                    </Text>
                    <Text style={styles.when}>{formatWait(arrival.time)}</Text>
                  </View>
                ))
              )}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: 16, paddingBottom: 120, gap: 12 },
    title: { color: palette.text, fontSize: 32, fontWeight: "700", marginTop: 8 },
    meta: { color: palette.muted, fontSize: 13 },
    button: {
      alignSelf: "flex-start",
      backgroundColor: palette.blue,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    buttonText: { color: "#FFFFFF", fontWeight: "700" },
    card: { backgroundColor: palette.panelSolid, borderRadius: 20, padding: 14, gap: 10 },
    head: { gap: 2 },
    name: { color: palette.text, fontSize: 17, fontWeight: "700" },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    badge: {
      minWidth: 40,
      height: 32,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    badgeText: { fontWeight: "800" },
    detail: { flex: 1, color: palette.text, fontSize: 15 },
    when: { color: palette.text, fontWeight: "700", fontVariant: ["tabular-nums"] },
  });
}
