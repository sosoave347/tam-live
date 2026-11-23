import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { ALERT_LABELS } from "@/lib/gtfs-rt";
import { routeFor } from "@/lib/network";
import { useService } from "@/lib/service";

export default function AlertsScreen() {
  const styles = useStyles(createStyles);
  const { alerts } = useService();

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Perturbations</Text>
        {alerts.length === 0 ? (
          <View style={styles.calm}>
            <Text style={styles.calmTitle}>Aucune</Text>
            <Text style={styles.meta}>Le réseau ne signale pas d'alerte.</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.card}>
              <Text style={styles.kind}>{ALERT_LABELS[alert.effect ?? 7] ?? "Alerte"}</Text>
              <Text style={styles.header}>{alert.header}</Text>
              {alert.routeIds.length > 0 ? (
                <Text style={styles.meta}>{alert.routeIds.map((id) => routeFor(id)?.shortName ?? id).join("  ")}</Text>
              ) : null}
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
    calm: { backgroundColor: palette.panelSolid, borderRadius: 20, padding: 16, gap: 4 },
    calmTitle: { color: palette.ok, fontSize: 17, fontWeight: "700" },
    card: { backgroundColor: "rgba(255,149,0,0.12)", borderRadius: 20, padding: 16, gap: 4 },
    kind: { color: palette.warn, fontSize: 12, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
    header: { color: palette.text, fontSize: 17, fontWeight: "700" },
    meta: { color: palette.muted, fontSize: 14 },
  });
}
