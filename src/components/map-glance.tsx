import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";

import { palette } from "@/constants/theme";
import { ALERT_LABELS } from "@/lib/gtfs-rt";
import { arrivalsNear, formatDistance, formatWait, plansBetween } from "@/lib/commute";
import { useUserLocation } from "@/lib/location";
import { usePlaces } from "@/lib/places";
import { useService } from "@/lib/service";
import { walkMinutes } from "@/lib/stops";

export function MapGlance() {
  const router = useRouter();
  const { coords, granted, request } = useUserLocation();
  const { home, work } = usePlaces();
  const { trips, alerts } = useService();
  const here = coords ?? home;
  const nearby = here ? arrivalsNear(here, trips, alerts) : [];
  const plans = home && work ? plansBetween(home, work, trips, alerts) : [];
  const plan = plans[0];
  const stop = nearby[0];
  const alert = alerts[0];

  return (
    <Pressable style={styles.card} onPress={() => router.push("/trajet")}>
      {alert ? (
        <Text style={styles.alert} numberOfLines={1}>
          {ALERT_LABELS[alert.effect ?? 7] ?? "Alerte"} · {alert.header}
        </Text>
      ) : (
        <Text style={styles.kicker}>Circulation suivie en temps réel</Text>
      )}

      {plan ? (
        <View style={styles.row}>
          <Badge color={plan.color} text={plan.textColor} label={plan.shortName} />
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>
              Vers le travail · {plan.boardName}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {plan.walkMinutes} min à pied
              {plan.destination ? ` · vers ${plan.destination}` : ""}
              {plan.disrupted ? " · perturbé" : ""}
            </Text>
          </View>
          <Text style={styles.time}>{formatWait(plan.departureTime)}</Text>
        </View>
      ) : stop ? (
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title} numberOfLines={1}>
              {stop.cluster.name}
            </Text>
            <Text style={styles.meta}>
              {formatDistance(stop.cluster.distance)} · {walkMinutes(stop.cluster.distance)} min à pied
            </Text>
          </View>
          {stop.next[0] ? (
            <View style={styles.eta}>
              <Badge color={stop.next[0].color} text={stop.next[0].textColor} label={stop.next[0].shortName} />
              <Text style={styles.time}>{formatWait(stop.next[0].time)}</Text>
            </View>
          ) : (
            <Text style={styles.meta}>aucun passage</Text>
          )}
        </View>
      ) : (
        <View style={styles.row}>
          <View style={styles.copy}>
            <Text style={styles.title}>
              {coords ? "Aucun arrêt TaM à proximité" : granted ? "Position en cours…" : "Voir les prochains passages"}
            </Text>
            <Text style={styles.meta}>Domicile, travail, et lignes autour de toi</Text>
          </View>
          {!granted ? (
            <Pressable
              style={styles.action}
              onPress={(event) => {
                event.stopPropagation();
                request();
              }}>
              <Text style={styles.actionText}>Position</Text>
            </Pressable>
          ) : null}
        </View>
      )}
    </Pressable>
  );
}

function Badge({ color, text, label }: { color: string; text: string; label: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: color }]}>
      <Text style={[styles.badgeText, { color: text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 22,
    backgroundColor: palette.panel,
    gap: 8,
  },
  kicker: {
    color: palette.ok,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  alert: {
    color: palette.warn,
    fontSize: 12,
    fontWeight: "700",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
  },
  time: {
    color: palette.text,
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  eta: {
    alignItems: "flex-end",
    gap: 4,
  },
  badge: {
    minWidth: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 15,
  },
  action: {
    backgroundColor: palette.text,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  actionText: {
    color: palette.ink,
    fontWeight: "700",
  },
});
