import { Pressable, StyleSheet, Text, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { usePalette, useStyles } from "@/lib/appearance";
import { formatAge, formatSpeed, isStale } from "@/lib/format";
import { useLive } from "@/lib/live";
import { destinationFor, modeLabel, routeFor } from "@/lib/network";

export function VehicleSheet() {
  const styles = useStyles(createStyles);
  const palette = usePalette();
  const { selected, selectedId, setSelectedId, visible, loading } = useLive();

  if (!selectedId) {
    return (
      <View style={styles.card}>
        <Text style={styles.lead}>
          {loading ? "Chargement des positions…" : `${visible.length} véhicules affichés`}
        </Text>
        <Text style={styles.body}>
          Touche un tram ou un bus sur la carte. Les positions viennent du flux temps réel TaM et se
          rafraîchissent toutes les 10 secondes.
        </Text>
        <Text style={styles.credit}>Montpellier Méditerranée Métropole / TaM · ODbL</Text>
      </View>
    );
  }

  const route = selected ? routeFor(selected.routeId) : undefined;
  const destination = destinationFor(route, selected?.directionId);
  const speed = formatSpeed(selected?.speedMps);
  const color = route?.color ?? palette.muted;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.badge, { backgroundColor: color }]}>
          <Text style={[styles.badgeText, { color: route?.textColor ?? "#FFFFFF" }]}>
            {route?.shortName ?? selected?.routeId ?? "?"}
          </Text>
        </View>
        <View style={styles.headText}>
          <Text style={styles.lead}>{route ? `${modeLabel(route.mode)} ${route.shortName}` : "Véhicule"}</Text>
          <Text style={styles.body} numberOfLines={1}>
            {route?.longName ?? "Ligne hors référentiel"}
          </Text>
        </View>
        <Pressable onPress={() => setSelectedId(null)} hitSlop={10} style={styles.close}>
          <Text style={styles.closeText}>×</Text>
        </Pressable>
      </View>

      {selected ? (
        <View style={styles.meta}>
          <Text style={styles.body}>{destination ? `Vers ${destination}` : "Destination non précisée"}</Text>
          <Text style={styles.body}>
            Véhicule {selected.label}
            {speed ? ` · ${speed}` : ""}
            {isStale(selected.timestamp) ? " · position ancienne" : ""}
          </Text>
          <Text style={styles.credit}>{formatAge(selected.timestamp)}</Text>
        </View>
      ) : (
        <Text style={styles.body}>Ce véhicule ne diffuse plus sa position.</Text>
      )}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
  card: {
    marginHorizontal: 12,
    padding: 14,
    borderRadius: 22,
    backgroundColor: palette.panel,
    gap: 8,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headText: {
    flex: 1,
    gap: 2,
  },
  badge: {
    minWidth: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 16,
  },
  lead: {
    color: palette.text,
    fontSize: 16,
    fontWeight: "700",
  },
  body: {
    color: palette.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  credit: {
    color: palette.muted,
    fontSize: 11,
  },
  meta: {
    gap: 2,
  },
  close: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: palette.fill,
  },
  closeText: {
    color: palette.text,
    fontSize: 22,
    lineHeight: 24,
  },
  });
}
