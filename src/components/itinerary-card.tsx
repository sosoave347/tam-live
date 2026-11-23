import { Pressable, StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { type Itinerary } from "@/lib/amigo";
import { useStyles } from "@/lib/appearance";

export function ItineraryCard({ itinerary, onPress }: { itinerary: Itinerary; onPress: () => void }) {
  const styles = useStyles(createStyles);
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <Text style={styles.time}>{itinerary.departAt}</Text>
      <View style={styles.center}>
        <Text style={styles.duration}>{itinerary.totalMin} min</Text>
        <View style={styles.steps}>
          {itinerary.legs.length === 0 ? (
            <Text style={styles.walk}>À pied</Text>
          ) : (
            itinerary.legs.map((leg) => (
              <View key={`${leg.routeId}-${leg.boardName}`} style={[styles.badge, { backgroundColor: leg.color }]}>
                <Text style={[styles.badgeText, { color: leg.textColor }]}>{leg.shortName}</Text>
              </View>
            ))
          )}
          {itinerary.walkMin > 0 && itinerary.legs.length > 0 ? <Text style={styles.walk}>{itinerary.walkMin} min</Text> : null}
        </View>
      </View>
      <Text style={styles.time}>{itinerary.arriveAt}</Text>
    </Pressable>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor: palette.fill,
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    time: {
      color: palette.text,
      fontSize: 17,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    center: {
      flex: 1,
      alignItems: "center",
      gap: 4,
    },
    duration: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    steps: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    badge: {
      minWidth: 26,
      height: 22,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: "800",
    },
    walk: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
