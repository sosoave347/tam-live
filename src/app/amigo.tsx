import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { type Palette } from "@/constants/theme";
import { planJourney, type Itinerary, type TripPreference } from "@/lib/amigo";
import { usePalette, useStyles } from "@/lib/appearance";
import { geocodeMetropole, readableAddress } from "@/lib/geocode";
import { useJourney } from "@/lib/journey";
import { useUserLocation } from "@/lib/location";
import { usePick } from "@/lib/pick";
import { usePlaces } from "@/lib/places";
import { useService } from "@/lib/service";

const PREFERENCES: { id: TripPreference; label: string }[] = [
  { id: "fast", label: "Rapide" },
  { id: "tram", label: "Tram" },
  { id: "bus", label: "Bus" },
  { id: "direct", label: "Direct" },
];

const ORIGINS = [
  ["here", "Ici"],
  ["home", "Domicile"],
  ["work", "Travail"],
  ["pin", "Point"],
] as const;

export default function AmigoScreen() {
  const router = useRouter();
  const palette = usePalette();
  const styles = useStyles(createStyles);
  const { coords, request } = useUserLocation();
  const { home, work, focusOn } = usePlaces();
  const { trips } = useService();
  const { setJourney } = useJourney();
  const pick = usePick();
  const [query, setQuery] = useState("");
  const [originKind, setOriginKind] = useState<(typeof ORIGINS)[number][0]>("here");
  const [preference, setPreference] = useState<TripPreference>("fast");
  const [anchor, setAnchor] = useState<{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number; address: string };
  } | null>(null);
  const [results, setResults] = useState<Itinerary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hereLabel, setHereLabel] = useState<string | null>(null);
  const [planned, setPlanned] = useState(false);
  const [dayOffset, setDayOffset] = useState(1);
  const [clock, setClock] = useState(8 * 60);
  const searched = useRef(false);
  const searchRef = useRef<() => void>(() => undefined);

  useEffect(() => {
    if (pick.destination) setQuery("");
  }, [pick.destination]);

  useEffect(() => {
    if (!coords || originKind !== "here") return;
    let alive = true;
    readableAddress(coords.latitude, coords.longitude, "").then((label) => {
      if (alive && label) setHereLabel(label);
    });
    return () => {
      alive = false;
    };
  }, [coords?.latitude, coords?.longitude, originKind]);

  useEffect(() => {
    if (!searched.current) return;
    searchRef.current();
  }, [preference, planned, dayOffset, clock]);

  function chooseOrigin(kind: (typeof ORIGINS)[number][0]) {
    setOriginKind(kind);
    if (kind === "pin") {
      pick.start("origin");
      router.push("/");
    }
  }

  function dropDestination() {
    pick.start("destination");
    router.push("/");
  }

  async function search() {
    searched.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const origin = await resolveOrigin();
      const destination =
        pick.destination && query.trim().length === 0
          ? pick.destination
          : await geocodeMetropole(query, origin);
      const instant = chosenInstant();
      if (instant && instant.getTime() < Date.now() - 60_000) {
        setResults([]);
        setMessage("Cette heure est passée.");
        return;
      }
      const plans = planJourney(origin, destination, trips, preference, Date.now() / 1000, instant ? instant.getTime() / 1000 : null);
      setAnchor({ origin, destination });
      setResults(plans);
      if (plans.length === 0) {
        setMessage(preference === "tram" ? "Aucun tram à moins de 20 min à pied." : "Aucun trajet trouvé.");
      } else remember(plans[0], origin, destination);
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setBusy(false);
    }
  }
  searchRef.current = search;

  function chosenInstant() {
    if (!planned) return null;
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + dayOffset);
    date.setMinutes(clock);
    return date;
  }

  async function resolveOrigin() {
    if (originKind === "home") {
      if (!home) throw new Error("Enregistre d'abord le domicile.");
      return home;
    }
    if (originKind === "work") {
      if (!work) throw new Error("Enregistre d'abord le travail.");
      return work;
    }
    if (originKind === "pin") {
      if (!pick.origin) throw new Error("Place le point de départ.");
      return pick.origin;
    }
    if (coords) return coords;
    const allowed = await request();
    if (!allowed) throw new Error("Autorise la position, ou pars du domicile.");
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }

  function remember(
    itinerary: Itinerary,
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number; address: string },
  ) {
    setJourney({ itinerary, origin, destination });
    focusOn(destination.latitude, destination.longitude);
  }

  function open(itinerary: Itinerary) {
    if (anchor) remember(itinerary, anchor.origin, anchor.destination);
    router.push("/");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Amigo</Text>

        <View style={styles.card}>
          <Text style={styles.label}>Départ</Text>
          <View style={styles.segment}>
            {ORIGINS.map(([id, label]) => (
              <Pressable key={id} onPress={() => chooseOrigin(id)} style={[styles.segmentItem, originKind === id && styles.segmentOn]}>
                <Text style={[styles.segmentText, originKind === id && styles.segmentTextOn]} numberOfLines={1}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          {originKind === "here" && hereLabel ? (
            <Text style={styles.meta} numberOfLines={1}>
              {hereLabel}
            </Text>
          ) : null}
          {originKind === "pin" && pick.origin ? (
            <Text style={styles.meta} numberOfLines={1}>
              {pick.origin.address}
            </Text>
          ) : null}

          <Text style={styles.label}>Arrivée</Text>
          <View style={styles.arrival}>
            <TextInput
              value={query}
              onChangeText={(value) => {
                setQuery(value);
                if (value.trim().length > 0) pick.clear("destination");
              }}
              placeholder={pick.destination ? pick.destination.address : "Adresse"}
              placeholderTextColor={palette.muted}
              style={styles.input}
              autoCorrect={false}
              returnKeyType="search"
              onSubmitEditing={search}
            />
            <Pressable style={[styles.point, pick.destination && query.trim().length === 0 && styles.segmentOn]} onPress={dropDestination}>
              <Text style={pick.destination && query.trim().length === 0 ? styles.segmentTextOn : styles.segmentText}>Point</Text>
            </Pressable>
          </View>
          <View style={styles.segment}>
            <Pressable onPress={() => setPlanned(false)} style={[styles.segmentItem, !planned && styles.segmentOn]}>
              <Text style={[styles.segmentText, !planned && styles.segmentTextOn]}>Maintenant</Text>
            </Pressable>
            <Pressable onPress={() => setPlanned(true)} style={[styles.segmentItem, planned && styles.segmentOn]}>
              <Text style={[styles.segmentText, planned && styles.segmentTextOn]}>
                {planned ? `${dayLabel(dayOffset)} ${formatClock(clock)}` : "Heure"}
              </Text>
            </Pressable>
          </View>
          {planned ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days}>
                {[0, 1, 2, 3, 4, 5, 6].map((offset) => (
                  <Pressable
                    key={offset}
                    onPress={() => setDayOffset(offset)}
                    style={[styles.day, dayOffset === offset && styles.segmentOn]}>
                    <Text style={[styles.segmentText, dayOffset === offset && styles.segmentTextOn]}>{dayLabel(offset)}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={styles.clockRow}>
                <Pressable style={styles.point} onPress={() => setClock((value) => Math.max(5 * 60, value - 15))}>
                  <Text style={styles.segmentTextOn}>–</Text>
                </Pressable>
                <Text style={styles.clock}>{formatClock(clock)}</Text>
                <Pressable style={styles.point} onPress={() => setClock((value) => Math.min(23 * 60 + 45, value + 15))}>
                  <Text style={styles.segmentTextOn}>+</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          <View style={styles.segment}>
            {PREFERENCES.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setPreference(item.id)}
                style={[styles.segmentItem, preference === item.id && styles.segmentOn]}>
                <Text style={[styles.segmentText, preference === item.id && styles.segmentTextOn]}>{item.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={styles.button} onPress={search} disabled={busy}>
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Chercher</Text>}
          </Pressable>
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
        {results.map((itinerary, index) => (
          <Pressable key={itinerary.id} style={styles.result} onPress={() => open(itinerary)}>
            <View style={styles.resultHead}>
              <Text style={styles.rank}>{index === 0 ? "Meilleur" : `Option ${index + 1}`}</Text>
              <Text style={styles.total}>{itinerary.totalMin} min</Text>
            </View>
            <Text style={styles.summary}>{itinerary.summary}</Text>
            {itinerary.legs.length === 0 ? (
              <Text style={styles.meta}>{itinerary.walkMin} min de marche</Text>
            ) : (
              itinerary.legs.map((leg) => (
                <View key={`${itinerary.id}-${leg.routeId}-${leg.boardName}`} style={styles.leg}>
                  <View style={[styles.badge, { backgroundColor: leg.color }]}>
                    <Text style={[styles.badgeText, { color: leg.textColor }]}>{leg.shortName}</Text>
                  </View>
                  <Text style={styles.legText} numberOfLines={2}>
                    {leg.boardName} → {leg.alightName}
                    {"\n"}
                    {leg.boardAt ? `${leg.boardAt} · ${leg.rideMin} min` : `${leg.waitMin} min d'attente · ${leg.rideMin} min`}
                  </Text>
                </View>
              ))
            )}
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function dayLabel(offset: number) {
  if (offset === 0) return "Auj";
  if (offset === 1) return "Dem";
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"][date.getDay()];
}

function formatClock(total: number) {
  const hours = String(Math.floor(total / 60)).padStart(2, "0");
  const minutes = String(total % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg },
    content: { padding: 16, paddingBottom: 120, gap: 12 },
    title: { color: palette.text, fontSize: 40, fontWeight: "700", letterSpacing: -0.8 },
    card: { backgroundColor: palette.card, borderRadius: 22, padding: 16, gap: 10 },
    label: { color: palette.muted, fontSize: 13, fontWeight: "600" },
    arrival: { flexDirection: "row", gap: 8 },
    input: {
      flex: 1,
      backgroundColor: palette.fill,
      color: palette.text,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 14,
      fontSize: 17,
    },
    point: {
      backgroundColor: palette.fill,
      borderRadius: 14,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    segment: { flexDirection: "row", backgroundColor: palette.fill, borderRadius: 12, padding: 3, gap: 3 },
    segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
    segmentOn: { backgroundColor: palette.elevated },
    segmentText: { color: palette.muted, fontSize: 12, fontWeight: "600" },
    segmentTextOn: { color: palette.text },
    days: { gap: 6 },
    day: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, backgroundColor: palette.fill },
    clockRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    clock: { color: palette.text, fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
    button: { backgroundColor: palette.blue, borderRadius: 14, minHeight: 48, alignItems: "center", justifyContent: "center" },
    buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
    message: { color: palette.danger, fontSize: 15 },
    result: { backgroundColor: palette.card, borderRadius: 22, padding: 16, gap: 8 },
    resultHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
    rank: { color: palette.blue, fontWeight: "700", fontSize: 13, textTransform: "uppercase" },
    total: { color: palette.text, fontSize: 28, fontWeight: "700" },
    summary: { color: palette.text, fontSize: 16, fontWeight: "600" },
    meta: { color: palette.muted, fontSize: 13 },
    leg: { flexDirection: "row", gap: 10, alignItems: "center" },
    badge: { minWidth: 40, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    badgeText: { fontWeight: "800" },
    legText: { flex: 1, color: palette.text, fontSize: 14, lineHeight: 18 },
  });
}
