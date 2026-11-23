import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { DepartWhen, departInstant, nextQuarter } from "@/components/depart-when";
import { ItineraryCard } from "@/components/itinerary-card";
import { TripSearch } from "@/components/trip-search";
import { type Palette } from "@/constants/theme";
import { useStyles } from "@/lib/appearance";
import { planJourney, type Itinerary } from "@/lib/amigo";
import { useJourney } from "@/lib/journey";
import { useUserLocation } from "@/lib/location";
import { usePlaces } from "@/lib/places";
import { useService } from "@/lib/service";

export default function TripScreen() {
  const styles = useStyles(createStyles);
  const router = useRouter();
  const { coords } = useUserLocation();
  const { home, work } = usePlaces();
  const { setJourney } = useJourney();
  const { trips } = useService();
  const [planned, setPlanned] = useState(false);
  const [dayOffset, setDayOffset] = useState(0);
  const [clock, setClock] = useState(nextQuarter);
  const when = planned ? departInstant(dayOffset, clock) : null;
  const past = when != null && when.getTime() < Date.now() - 60_000;
  const commuteFrom = planned ? (home ?? coords) : (coords ?? home);
  const commute = useMemo(
    () =>
      commuteFrom && work && !past
        ? planJourney(commuteFrom, work, trips, "fast", Date.now() / 1000, when ? when.getTime() / 1000 : null)
        : [],
    [commuteFrom?.latitude, commuteFrom?.longitude, work, trips, past, when?.getTime()],
  );

  function openCommute(itinerary: Itinerary) {
    if (!commuteFrom || !work) return;
    setJourney({ itinerary, origin: commuteFrom, destination: work });
    router.push("/");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Trajet</Text>
        <TripSearch />
        <View style={styles.block}>
          <Text style={styles.label}>Vers le travail</Text>
          <View style={styles.card}>
            <DepartWhen
              planned={planned}
              dayOffset={dayOffset}
              clock={clock}
              onPlanned={setPlanned}
              onDay={setDayOffset}
              onClock={setClock}
            />
            {!work ? (
              <Text style={styles.meta}>Ajoute le travail dans Lignes.</Text>
            ) : past ? (
              <Text style={styles.meta}>Cette heure est passée.</Text>
            ) : !commuteFrom ? (
              <Text style={styles.meta}>Active la position, ou enregistre le domicile.</Text>
            ) : commute.length === 0 ? (
              <Text style={styles.meta}>Aucun trajet.</Text>
            ) : null}
          </View>
          {work && !past && commuteFrom
            ? commute.map((itinerary) => (
                <ItineraryCard key={itinerary.id} itinerary={itinerary} onPress={() => openCommute(itinerary)} />
              ))
            : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: palette.bg },
    content: { paddingHorizontal: 16, paddingBottom: 120, gap: 16 },
    title: { color: palette.text, fontSize: 32, fontWeight: "700", marginTop: 8 },
    block: { gap: 8 },
    label: {
      color: palette.muted,
      fontSize: 13,
      fontWeight: "700",
      letterSpacing: 0.3,
      textTransform: "uppercase",
      paddingHorizontal: 4,
    },
    card: { backgroundColor: palette.panelSolid, borderRadius: 20, padding: 12, gap: 10 },
    meta: { color: palette.muted, fontSize: 15 },
  });
}
