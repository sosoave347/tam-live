import { useEffect, useMemo, useState, type ReactNode } from "react";
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
} from "@/lib/commute";
import { useFavorites } from "@/lib/favorites";
import { ALERT_LABELS } from "@/lib/gtfs-rt";
import { planJourney, type Itinerary } from "@/lib/amigo";
import { useJourney } from "@/lib/journey";
import { useUserLocation } from "@/lib/location";
import { useLive } from "@/lib/live";
import { usePlaces, type SavedPlace } from "@/lib/places";
import { routeFor, routes } from "@/lib/network";
import { useService } from "@/lib/service";
import { walkMinutes } from "@/lib/stops";

export default function TripScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { coords, granted, request } = useUserLocation();
  const { home, work, focusOn } = usePlaces();
  const { setJourney } = useJourney();
  const { trips, alerts } = useService();
  const here = coords;
  const nearby = here ? arrivalsNear(here, trips, alerts) : [];
  const nearest = nearby[0];
  const commute = useMemo(
    () => (home && work ? planJourney(home, work, trips, "fast") : []),
    [home, work, trips],
  );

  function openCommute(itinerary: Itinerary) {
    if (!home || !work) return;
    setJourney({ itinerary, origin: home, destination: work });
    focusOn(work.latitude, work.longitude);
    router.push("/");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Trajet</Text>
        <AppearanceControl />
        <Pressable style={styles.amigo} onPress={() => router.push("/amigo")}>
          <View style={styles.amigoMark}>
            <Text style={styles.amigoMarkText}>A</Text>
          </View>
          <View style={styles.copy}>
            <Text style={styles.cardTitle}>Amigo</Text>
            <Text style={styles.meta}>Itinéraire</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>

        <Section title="Adresses">
          <PlaceCard kind="home" title="Domicile" place={home} />
          <PlaceCard kind="work" title="Travail" place={work} />
        </Section>

        <Section title="Perturbations">
          {alerts.length === 0 ? (
            <Text style={styles.meta}>Aucune</Text>
          ) : (
            alerts.map((alert) => (
              <View key={alert.id} style={styles.alertCard}>
                <Text style={styles.alertKind}>{ALERT_LABELS[alert.effect ?? 7] ?? "Alerte"}</Text>
                <Text style={styles.cardTitle}>{alert.header}</Text>
                {alert.routeIds.length > 0 ? (
                  <Text style={styles.meta}>{alert.routeIds.map((id) => routeFor(id)?.shortName ?? id).join(" ")}</Text>
                ) : null}
              </View>
            ))
          )}
        </Section>

        <Section
          title="Autour de toi"
          extra={
            !granted ? (
              <Pressable onPress={request}>
                <Text style={styles.link}>Activer</Text>
              </Pressable>
            ) : nearest ? (
              <Text style={styles.meta} numberOfLines={1}>
                {formatDistance(nearest.cluster.distance)}
              </Text>
            ) : null
          }>
          {!here ? (
            <Text style={styles.meta}>{granted ? "Position en cours…" : "Active la position."}</Text>
          ) : (
            nearby.map(({ cluster, next }) => (
              <View key={cluster.ids[0]} style={styles.stopCard}>
                <Text style={styles.cardTitle}>{cluster.name}</Text>
                <Text style={styles.meta}>
                  {formatDistance(cluster.distance)} · {walkMinutes(cluster.distance)} min
                </Text>
                {next.length === 0 ? (
                  <Text style={styles.meta}>Pas de passage</Text>
                ) : (
                  next.map((arrival) => (
                    <ArrivalLine
                      key={`${cluster.ids[0]}-${arrival.routeId}`}
                      routeId={arrival.routeId}
                      color={arrival.color}
                      textColor={arrival.textColor}
                      shortName={arrival.shortName}
                      detail={arrival.destination ?? (arrival.mode === "tram" ? "Tram" : "Bus")}
                      when={formatWait(arrival.time)}
                      disrupted={arrival.disrupted}
                    />
                  ))
                )}
              </View>
            ))
          )}
        </Section>

        <Section title="Vers le travail">
          {!home || !work ? (
            <Text style={styles.meta}>Ajoute le domicile et le travail.</Text>
          ) : (
            <>
              <Text style={styles.meta} numberOfLines={2}>
                {home.address} → {work.address}
              </Text>
              {commute.length === 0 ? (
                <Text style={styles.meta}>Aucun trajet entre ces deux points.</Text>
              ) : (
                commute.map((itinerary) => (
                  <Pressable key={itinerary.id} style={styles.stopCard} onPress={() => openCommute(itinerary)}>
                    <View style={styles.stopHead}>
                      <Text style={styles.cardTitle}>{itinerary.totalMin} min</Text>
                      <Text style={styles.meta}>{itinerary.summary}</Text>
                    </View>
                    {itinerary.legs.map((leg) => (
                      <ArrivalLine
                        key={`${itinerary.id}-${leg.routeId}-${leg.boardName}`}
                        routeId={leg.routeId}
                        color={leg.color}
                        textColor={leg.textColor}
                        shortName={leg.shortName}
                        detail={`${leg.boardName} → ${leg.alightName}`}
                        when={leg.boardAt ?? `${leg.waitMin} min`}
                        disrupted={false}
                      />
                    ))}
                  </Pressable>
                ))
              )}
            </>
          )}
        </Section>

        <LinesSection />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, extra, children }: { title: string; extra?: ReactNode; children: ReactNode }) {
  const styles = useStyles(createStyles);
  return (
    <View style={styles.sectionBlock}>
      <View style={styles.sectionHead}>
        <Text style={styles.sectionLabel}>{title}</Text>
        {extra}
      </View>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function LinesSection() {
  const styles = useStyles(createStyles);
  const palette = usePalette();
  const { ids, has, toggle, clear } = useFavorites();
  const { setFilter, setSelectedId } = useLive();
  const trams = routes.filter((route) => route.mode === "tram");

  function keep(id: string) {
    const removing = ids.includes(id);
    toggle(id);
    setSelectedId(null);
    setFilter(removing && ids.length === 1 ? { mode: "all", routeId: null } : { mode: "saved", routeId: null });
  }

  return (
    <Section
      title="Mes lignes"
      extra={
        ids.length > 0 ? (
          <Pressable
            onPress={() => {
              clear();
              setFilter({ mode: "all", routeId: null });
            }}>
            <Text style={styles.link}>Effacer</Text>
          </Pressable>
        ) : null
      }>
      <View style={styles.chips}>
        {trams.map((route) => {
          const on = has(route.id);
          return (
            <Pressable
              key={route.id}
              onPress={() => keep(route.id)}
              style={[styles.chip, { backgroundColor: on ? route.color : palette.fill }]}>
              <Text style={[styles.chipText, { color: on ? route.textColor : palette.text }]}>{route.shortName}</Text>
            </Pressable>
          );
        })}
      </View>
    </Section>
  );
}

function PlaceCard({ kind, title, place }: { kind: "home" | "work"; title: string; place: SavedPlace | null }) {
  const styles = useStyles(createStyles);
  const palette = usePalette();
  const { coords } = useUserLocation();
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
        <Pressable style={styles.primary} disabled={busy} onPress={() => run(() => saveAddress(kind, draft, coords ?? undefined))}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>OK</Text>}
        </Pressable>
        <Pressable style={styles.secondary} disabled={busy} onPress={() => run(() => saveHere(kind))}>
          <Text style={styles.secondaryText}>Ici</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
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
  amigo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: palette.panelSolid,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
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
  chevron: {
    color: palette.muted,
    fontSize: 22,
    fontWeight: "600",
  },
  sectionBlock: {
    gap: 8,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
  sectionLabel: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  sectionCard: {
    backgroundColor: palette.panelSolid,
    borderRadius: 20,
    padding: 12,
    gap: 10,
  },
  fold: {
    backgroundColor: palette.panelSolid,
    borderRadius: 16,
    overflow: "hidden",
  },
  foldHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 12,
  },
  foldTap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  foldTitle: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  foldHint: {
    flex: 1,
    color: palette.muted,
    fontSize: 13,
    textAlign: "right",
  },
  foldMark: {
    color: palette.muted,
    fontSize: 18,
    fontWeight: "600",
  },
  foldBody: {
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    minWidth: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  chipText: {
    fontWeight: "800",
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
    gap: 10,
  },
  stopCard: {
    backgroundColor: palette.fill,
    borderRadius: 16,
    padding: 12,
    gap: 8,
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
