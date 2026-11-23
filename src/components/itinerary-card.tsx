import { Pressable, StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { type Itinerary } from "@/lib/amigo";
import { useStyles } from "@/lib/appearance";

export function ItineraryCard({ itinerary, onPress }: { itinerary: Itinerary; onPress: () => void }) {
  const styles = useStyles(createStyles);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.head}>
        <Text style={styles.time}>
          {itinerary.departAt} – {itinerary.arriveAt}
        </Text>
        <Text style={styles.duration}>{itinerary.totalMin} min</Text>
      </View>
      <Text style={styles.detail} numberOfLines={1}>
        {describe(itinerary)}
      </Text>
    </Pressable>
  );
}

function describe(itinerary: Itinerary) {
  if (itinerary.legs.length === 0) return `${itinerary.walkMin} min à pied`;
  const lines = itinerary.legs.map((leg) => `${leg.mode === "tram" ? "Tram" : "Bus"} ${leg.shortName}`).join(" · ");
  const walk = itinerary.walkMin > 0 ? `${itinerary.walkMin} min à pied · ` : "";
  return `${walk}${lines}`;
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.panelSolid,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 4,
    },
    head: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 12,
    },
    time: {
      color: palette.text,
      fontSize: 17,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    duration: {
      color: palette.blue,
      fontSize: 17,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    detail: {
      color: palette.muted,
      fontSize: 14,
    },
  });
}
