import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppearanceControl } from "@/components/appearance-control";
import { type Palette } from "@/constants/theme";
import { usePalette, useStyles } from "@/lib/appearance";
import {
  arrivalsNear,
  formatDistance,
  formatWait,
  plansBetween,
  type RidePlan,
} from "@/lib/commute";
import { ALERT_LABELS } from "@/lib/gtfs-rt";
import { useUserLocation } from "@/lib/location";
import { useLive } from "@/lib/live";
import { usePlaces, type SavedPlace } from "@/lib/places";
import { routeFor } from "@/lib/network";
import { useService } from "@/lib/service";
import { walkMinutes } from "@/lib/stops";

export default function TripScreen() {
  const styles = useStyles(createStyles);
  const { coords, granted, request } = useUserLocation();
  const { home, work } = usePlaces();
  const { trips, alerts } = useService();
  const here = coords;
  const nearby = here ? arrivalsNear(here, trips, alerts) : [];
  const plans = home && work ? plansBetween(home, work, trips, alerts) : [];

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.kicker}>Ton trajet</Text>
        <Text style={styles.title}>Domicile et travail</Text>
        <AppearanceControl />
        <Text style={styles.intro}>
          Les conseils suivent ta position, les prochains passages TaM et les alertes de perturbation.
        </Text>

        <PlaceCard kind="home" title="Domicile" place={home} />
        <PlaceCard kind="work" title="Travail" place={work} />

        <Text style={styles.section}>Perturbations</Text>
        {alerts.length === 0 ? (
          <View style={styles.calm}>
            <Text style={styles.calmTitle}>Aucune alerte en cours</Text>
            <Text style={styles.meta}>Le flux TaM ne signale ni travaux ni coupure.</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <View key={alert.id} style={styles.alertCard}>
              <Text style={styles.alertKind}>{ALERT_LABELS[alert.effect ?? 7] ?? "Alerte"}</Text>
              <Text style={styles.cardTitle}>{alert.header}</Text>
              {alert.description ? <Text style={styles.meta}>{alert.description}</Text> : null}
              {alert.routeIds.length > 0 ? (
                <Text style={styles.meta}>
                  Lignes {alert.routeIds.map((id) => routeFor(id)?.shortName ?? id).join(", ")}
                </Text>
              ) : null}
            </View>
          ))
        )}

        <View style={styles.sectionRow}>
          <Text style={styles.section}>Autour de toi</Text>
          {!granted ? (
            <Pressable onPress={request}>
              <Text style={styles.link}>Activer</Text>
            </Pressable>
          ) : null}
        </View>
        {!here ? (
          <Text style={styles.meta}>
            {granted ? "Position en cours…" : "Autorise la position pour voir les arrêts et les prochains départs."}
          </Text>
        ) : (
          nearby.map(({ cluster, next }) => (
            <View key={cluster.ids[0]} style={styles.stopCard}>
              <View style={styles.stopHead}>
                <View style={styles.copy}>
                  <Text style={styles.cardTitle}>{cluster.name}</Text>
                  <Text style={styles.meta}>
                    {formatDistance(cluster.distance)} · {walkMinutes(cluster.distance)} min à pied
                  </Text>
                </View>
              </View>
              {next.length === 0 ? (
                <Text style={styles.meta}>Pas de passage annoncé dans l'heure.</Text>
              ) : (
                next.map((arrival) => (
                  <ArrivalLine
                    key={`${cluster.ids[0]}-${arrival.routeId}`}
                    routeId={arrival.routeId}
                    color={arrival.color}
                    textColor={arrival.textColor}
                    shortName={arrival.shortName}
                    detail={arrival.destination ? `vers ${arrival.destination}` : arrival.mode === "tram" ? "Tram" : "Bus"}
                    when={formatWait(arrival.time)}
                    disrupted={arrival.disrupted}
                  />
                ))
              )}
            </View>
          ))
        )}

        <Text style={styles.section}>Pour aller au travail</Text>
        {!home || !work ? (
          <Text style={styles.meta}>Enregistre le domicile et le travail pour obtenir les lignes directes.</Text>
        ) : plans.length === 0 ? (
          <Text style={styles.meta}>Aucune ligne directe ne relie ces deux adresses à moins de 850 m d'un arrêt.</Text>
        ) : (
          plans.map((plan) => <RideCard key={plan.routeId} plan={plan} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PlaceCard({ kind, title, place }: { kind: "home" | "work"; title: string; place: SavedPlace | null }) {
  const styles = useStyles(createStyles);
  const palette = usePalette();
  const { saveAddress, saveHere, clearPlace } = usePlaces();
  const [draft, setDraft] = useState(place?.address ?? "");
  useEffect(() => {
    if (place?.address) setDraft(place.address);
  }, [place?.address]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.place}>
      <View style={styles.stopHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {place ? (
          <Pressable onPress={() => clearPlace(kind)}>
            <Text style={styles.link}>Effacer</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Adresse"
        placeholderTextColor={palette.muted}
        style={styles.input}
        autoCorrect={false}
      />
      <View style={styles.actions}>
        <Pressable style={styles.primary} disabled={busy} onPress={() => run(() => saveAddress(kind, draft))}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>Enregistrer</Text>}
        </Pressable>
        <Pressable style={styles.secondary} disabled={busy} onPress={() => run(() => saveHere(kind))}>
          <Text style={styles.secondaryText}>Ma position</Text>
        </Pressable>
      </View>
      {place ? <Text style={styles.meta}>{place.address}</Text> : null}
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function RideCard({ plan }: { plan: RidePlan }) {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { setFilter, setSelectedId } = useLive();
  const { focusOn } = usePlaces();

  function openOnMap() {
    const route = routeFor(plan.routeId);
    setSelectedId(null);
    setFilter({ mode: route?.mode ?? "bus", routeId: plan.routeId });
    focusOn(plan.boardLatitude, plan.boardLongitude);
    router.push("/");
  }

  return (
    <Pressable style={styles.stopCard} onPress={openOnMap}>
      <ArrivalLine
        routeId={plan.routeId}
        color={plan.color}
        textColor={plan.textColor}
        shortName={plan.shortName}
        detail={`${plan.boardName} → ${plan.alightName}`}
        when={formatWait(plan.departureTime)}
        disrupted={plan.disrupted}
      />
      <Text style={styles.meta}>
        {plan.walkMinutes} min à pied jusqu'à {plan.boardName}
        {plan.destination ? ` · direction ${plan.destination}` : ""}
        {plan.disrupted ? " · ligne signalée en alerte" : ""}
      </Text>
    </Pressable>
  );
}

function ArrivalLine({
  color,
  textColor,
  shortName,
  detail,
  when,
  disrupted,
}: {
  routeId: string;
  color: string;
  textColor: string;
  shortName: string;
  detail: string;
  when: string;
  disrupted: boolean;
}) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.arrival}>
      <View style={[styles.badge, { backgroundColor: color }]}>
        <Text style={[styles.badgeText, { color: textColor }]}>{shortName}</Text>
      </View>
      <Text style={styles.detail} numberOfLines={1}>
        {detail}
        {disrupted ? " · alerte" : ""}
      </Text>
      <Text style={styles.when}>{when}</Text>
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 120,
    gap: 10,
  },
  kicker: {
    marginTop: 8,
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 12,
  },
  title: {
    color: palette.text,
    fontSize: 32,
    fontWeight: "700",
  },
  intro: {
    color: palette.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  section: {
    color: palette.text,
    fontSize: 20,
    fontWeight: "700",
    marginTop: 12,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  place: {
    backgroundColor: palette.panelSolid,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  stopCard: {
    backgroundColor: palette.panelSolid,
    borderRadius: 20,
    padding: 14,
    gap: 10,
  },
  calm: {
    backgroundColor: "rgba(142,228,193,0.08)",
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  calmTitle: {
    color: palette.ok,
    fontWeight: "700",
    fontSize: 16,
  },
  alertCard: {
    backgroundColor: "rgba(245,193,108,0.1)",
    borderRadius: 20,
    padding: 14,
    gap: 4,
  },
  alertKind: {
    color: palette.warn,
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  cardTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  meta: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  stopHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  copy: { flex: 1 },
  input: {
    backgroundColor: palette.fill,
    color: palette.text,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  primary: {
    backgroundColor: palette.blue,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 120,
    alignItems: "center",
  },
  primaryText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondary: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: palette.fill,
  },
  secondaryText: {
    color: palette.text,
    fontWeight: "700",
  },
  link: {
    color: palette.text,
    fontWeight: "700",
  },
  error: {
    color: palette.danger,
    fontSize: 13,
  },
  arrival: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  badge: {
    minWidth: 40,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: "800",
  },
  detail: {
    flex: 1,
    color: palette.text,
    fontSize: 14,
  },
  when: {
    color: palette.text,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  });
}
