import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";

import { ItineraryCard } from "@/components/itinerary-card";
import { type Palette } from "@/constants/theme";
import { planJourney, type Itinerary, type TripPreference } from "@/lib/amigo";
import { usePalette, useStyles } from "@/lib/appearance";
import { geocodeMetropole, readableAddress } from "@/lib/geocode";
import { useJourney } from "@/lib/journey";
import { useUserLocation } from "@/lib/location";
import { usePick } from "@/lib/pick";
import { usePlaces, type SavedPlace } from "@/lib/places";
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

export function TripSearch() {
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
    destination: SavedPlace;
  } | null>(null);
  const [results, setResults] = useState<Itinerary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hereLabel, setHereLabel] = useState<string | null>(null);
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
  }, [preference]);

  function chooseOrigin(kind: (typeof ORIGINS)[number][0]) {
    setOriginKind(kind);
    if (kind === "pin") {
      pick.start("origin", "/trajet");
      router.push("/");
    }
  }

  function dropDestination() {
    pick.start("destination", "/trajet");
    router.push("/");
  }

  async function search() {
    searched.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const origin = await resolveOrigin();
      const destination = pick.destination && query.trim().length === 0 ? pick.destination : await geocodeMetropole(query, origin);
      const plans = planJourney(origin, destination, trips, preference);
      setAnchor({ origin, destination });
      setResults(plans);
      setMessage(plans.length === 0 ? "Aucun trajet depuis ce point." : null);
    } catch (error) {
      setResults([]);
      setAnchor(null);
      setMessage(error instanceof Error ? error.message : "Recherche impossible.");
    } finally {
      setBusy(false);
    }
  }
  searchRef.current = search;

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
      if (!pick.origin) throw new Error("Place le point de départ sur la carte.");
      return pick.origin;
    }
    if (coords) return coords;
    const allowed = await request();
    if (!allowed) throw new Error("Autorise la position, ou pars du domicile.");
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  }

  function open(itinerary: Itinerary) {
    if (!anchor) return;
    setJourney({ itinerary, origin: anchor.origin, destination: anchor.destination });
    focusOn(anchor.destination.latitude, anchor.destination.longitude);
    router.push("/");
  }

  const originLabel =
    originKind === "here"
      ? hereLabel
      : originKind === "pin"
        ? pick.origin?.address
        : originKind === "home"
          ? home?.address
          : work?.address;

  return (
    <View style={styles.block}>
      <Text style={styles.sectionLabel}>Itinéraire</Text>
      <View style={styles.card}>
        <Text style={styles.fieldLabel}>Départ</Text>
        <View style={styles.segment}>
          {ORIGINS.map(([id, label]) => (
            <Pressable key={id} onPress={() => chooseOrigin(id)} style={[styles.segmentItem, originKind === id && styles.segmentOn]}>
              <Text style={[styles.segmentText, originKind === id && styles.segmentTextOn]} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
        {originLabel ? (
          <Text style={styles.meta} numberOfLines={1}>
            {originLabel}
          </Text>
        ) : null}
        <Text style={styles.fieldLabel}>Arrivée</Text>
        <View style={styles.arrivalRow}>
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
          <Pressable
            style={[styles.point, pick.destination && query.trim().length === 0 && styles.segmentOn]}
            onPress={dropDestination}>
            <Text style={pick.destination && query.trim().length === 0 ? styles.segmentTextOn : styles.segmentText}>Point</Text>
          </Pressable>
        </View>
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
      {message ? <Text style={styles.error}>{message}</Text> : null}
      {results.map((itinerary) => (
        <ItineraryCard key={itinerary.id} itinerary={itinerary} live={originKind === "here"} onPress={() => open(itinerary)} />
      ))}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    block: {
      gap: 8,
    },
    sectionLabel: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
      paddingHorizontal: 4,
    },
    card: {
      backgroundColor: palette.panelSolid,
      borderRadius: 20,
      padding: 12,
      gap: 10,
    },
    fieldLabel: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    meta: {
      color: palette.muted,
      fontSize: 13,
    },
    arrivalRow: {
      flexDirection: "row",
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: palette.fill,
      color: palette.text,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
    },
    point: {
      backgroundColor: palette.fill,
      borderRadius: 14,
      paddingHorizontal: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    segment: {
      flexDirection: "row",
      backgroundColor: palette.fill,
      borderRadius: 12,
      padding: 3,
      gap: 3,
    },
    segmentItem: {
      flex: 1,
      alignItems: "center",
      paddingVertical: 8,
      borderRadius: 10,
    },
    segmentOn: {
      backgroundColor: palette.panelSolid,
    },
    segmentText: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "700",
    },
    segmentTextOn: {
      color: palette.text,
    },
    button: {
      backgroundColor: palette.blue,
      borderRadius: 14,
      minHeight: 44,
      alignItems: "center",
      justifyContent: "center",
    },
    buttonText: {
      color: "#FFFFFF",
      fontWeight: "700",
      fontSize: 16,
    },
    error: {
      color: palette.danger,
      fontSize: 13,
      paddingHorizontal: 4,
    },
  });
}
