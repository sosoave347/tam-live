import { Pressable, StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { type Itinerary } from "@/lib/amigo";
import { useStyles } from "@/lib/appearance";

export function ItineraryCard({
  itinerary,
  live,
  onPress,
}: {
  itinerary: Itinerary;
  live?: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  const changes =
    itinerary.transfers === 0 ? "Direct" : itinerary.transfers === 1 ? "1 changement" : `${itinerary.transfers} changements`;

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.head}>
        <View>
          <Text style={styles.label}>Départ</Text>
          <Text style={styles.time}>{itinerary.departAt}</Text>
        </View>
        <View style={styles.arrive}>
          <Text style={styles.label}>Arrivée</Text>
          <Text style={styles.time}>{itinerary.arriveAt}</Text>
        </View>
      </View>
      <Text style={styles.meta}>
        {live ? "Temps réel · " : ""}
        {itinerary.totalMin} min · {itinerary.walkMin} min à pied · {changes}
      </Text>
      {itinerary.legs.length > 0 && itinerary.walkInMin > 0 ? (
        <Text style={styles.meta}>
          {itinerary.walkInMin} min à pied{itinerary.legs[0] ? ` jusqu'à ${itinerary.legs[0].boardName}` : ""}
        </Text>
      ) : null}
      {itinerary.legs.map((leg) => (
        <View key={`${leg.routeId}-${leg.boardName}-${leg.alightName}`} style={styles.leg}>
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: leg.color }]}>
              <Text style={[styles.badgeText, { color: leg.textColor }]}>{leg.shortName}</Text>
            </View>
            <View style={styles.copy}>
              <Text style={styles.detail} numberOfLines={1}>
                {leg.boardName} → {leg.alightName}
              </Text>
              {leg.destination ? (
                <Text style={styles.meta} numberOfLines={1}>
                  {leg.destination}
                </Text>
              ) : null}
            </View>
          </View>
          <Text style={styles.meta}>
            Départ {leg.boardAt} · {leg.waitMin} min d'attente · {leg.rideMin} min · arrivée {leg.alightAt}
          </Text>
        </View>
      ))}
      {itinerary.walkOutMin > 0 ? <Text style={styles.meta}>{itinerary.walkOutMin} min à pied jusqu'à l'arrivée</Text> : null}
    </Pressable>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    card: {
      backgroundColor: palette.fill,
      borderRadius: 16,
      padding: 12,
      gap: 8,
    },
    head: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-end",
    },
    arrive: {
      alignItems: "flex-end",
    },
    label: {
      color: palette.muted,
      fontSize: 12,
      fontWeight: "600",
    },
    time: {
      color: palette.text,
      fontSize: 22,
      fontWeight: "700",
      fontVariant: ["tabular-nums"],
    },
    meta: {
      color: palette.muted,
      fontSize: 13,
      lineHeight: 18,
    },
    leg: {
      gap: 4,
    },
    row: {
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
    copy: {
      flex: 1,
    },
    detail: {
      color: palette.text,
      fontSize: 14,
      fontWeight: "600",
    },
  });
}
