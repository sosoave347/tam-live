import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import { planJourney, type Itinerary, type TripPreference } from "@/lib/amigo";
import { useJourney } from "@/lib/journey";
import { useUserLocation } from "@/lib/location";
import { usePlaces } from "@/lib/places";
import { useService } from "@/lib/service";

const PREFERENCES: { id: TripPreference; label: string }[] = [
  { id: "fast", label: "Rapide" },
  { id: "tram", label: "Tram" },
  { id: "bus", label: "Bus" },
  { id: "direct", label: "Direct" },
];

export default function AmigoScreen() {
  const router = useRouter();
  const { coords, request } = useUserLocation();
  const { home, work, focusOn } = usePlaces();
  const { trips } = useService();
  const { setJourney } = useJourney();
  const [query, setQuery] = useState("");
  const [originKind, setOriginKind] = useState<"here" | "home" | "work">("here");
  const [preference, setPreference] = useState<TripPreference>("fast");
  const [anchor, setAnchor] = useState<{
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number; address: string };
  } | null>(null);
  const [results, setResults] = useState<Itinerary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    setMessage(null);
    try {
      const origin = await resolveOrigin();
      const destination = await geocode(query);
      const plans = planJourney(origin, destination, trips, preference);
      setAnchor({ origin, destination });
      setResults(plans);
      if (plans.length === 0) setMessage("Aucun trajet trouvé à proximité de cette adresse.");
      else remember(plans[0], origin, destination);
    } catch (error) {
      setResults([]);
      setMessage(error instanceof Error ? error.message : "Amigo n'a pas pu chercher.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveOrigin() {
    if (originKind === "home") {
      if (!home) throw new Error("Enregistre d'abord ton domicile dans Trajet.");
      return home;
    }
    if (originKind === "work") {
      if (!work) throw new Error("Enregistre d'abord ton travail dans Trajet.");
      return work;
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
        <Text style={styles.kicker}>Assistant</Text>
        <Text style={styles.title}>Amigo</Text>
        <Text style={styles.intro}>
          Une adresse, et je compare la marche, le tram et le bus pour te proposer le trajet le plus rapide.
        </Text>

        <View style={styles.card}>
          <Text style={styles.label}>Départ</Text>
          <View style={styles.segment}>
            {(
              [
                ["here", "Ici"],
                ["home", "Domicile"],
                ["work", "Travail"],
              ] as const
            ).map(([id, label]) => (
              <Pressable key={id} onPress={() => setOriginKind(id)} style={[styles.segmentItem, originKind === id && styles.segmentOn]}>
                <Text style={[styles.segmentText, originKind === id && styles.segmentTextOn]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.label}>Arrivée</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Adresse à Montpellier"
            placeholderTextColor={palette.muted}
            style={styles.input}
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={search}
          />
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
            {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Demander à Amigo</Text>}
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
                    {leg.waitMin} min d'attente · {leg.rideMin} min
                  </Text>
                </View>
              ))
            )}
            <Text style={styles.meta}>{itinerary.walkMin} min à pied · voir le tracé</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

async function geocode(query: string) {
  const trimmed = query.trim();
  if (trimmed.length < 3) throw new Error("Indique une adresse plus précise.");
  const biased = /montpellier/i.test(trimmed) ? trimmed : `${trimmed}, Montpellier`;
  const results = await Location.geocodeAsync(biased);
  const hit = results.find((item) => item.latitude > 43.45 && item.latitude < 43.78 && item.longitude > 3.62 && item.longitude < 4.08) ?? results[0];
  if (!hit) throw new Error("Adresse introuvable autour de Montpellier.");
  let address = trimmed;
  try {
    const [place] = await Location.reverseGeocodeAsync(hit);
    if (place) {
      const line = [place.streetNumber, place.street].filter(Boolean).join(" ");
      address = [line || place.name, place.city || "Montpellier"].filter(Boolean).join(", ");
    }
  } catch {
    address = trimmed;
  }
  return { latitude: hit.latitude, longitude: hit.longitude, address };
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.bg },
  content: { padding: 16, paddingBottom: 120, gap: 12 },
  kicker: { color: palette.muted, fontSize: 13, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.4 },
  title: { color: palette.text, fontSize: 40, fontWeight: "700", letterSpacing: -0.8 },
  intro: { color: palette.muted, fontSize: 16, lineHeight: 22 },
  card: { backgroundColor: palette.card, borderRadius: 22, padding: 16, gap: 10 },
  label: { color: palette.muted, fontSize: 13, fontWeight: "600" },
  input: {
    backgroundColor: palette.fill,
    color: palette.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 17,
  },
  segment: { flexDirection: "row", backgroundColor: palette.fill, borderRadius: 12, padding: 3, gap: 3 },
  segmentItem: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 10 },
  segmentOn: { backgroundColor: palette.card },
  segmentText: { color: palette.muted, fontSize: 13, fontWeight: "600" },
  segmentTextOn: { color: palette.text },
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
