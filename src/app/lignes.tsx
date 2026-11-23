import { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { palette } from "@/constants/theme";
import { formatClock } from "@/lib/format";
import { useLive } from "@/lib/live";
import { routes, type RouteInfo } from "@/lib/network";

export default function LinesScreen() {
  const router = useRouter();
  const { counts, filter, setFilter, setSelectedId, updatedAt, error, refresh } = useLive();
  const [query, setQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = (route: RouteInfo) =>
      !needle ||
      route.shortName.toLowerCase().includes(needle) ||
      route.longName.toLowerCase().includes(needle);
    const grouped = [
      { title: "Tramways", data: routes.filter((route) => route.mode === "tram" && matches(route)) },
      { title: "Bus", data: routes.filter((route) => route.mode === "bus" && matches(route)) },
    ];
    return grouped.filter((section) => section.data.length > 0);
  }, [query]);

  function openRoute(route: RouteInfo) {
    setSelectedId(null);
    setFilter(
      filter.routeId === route.id
        ? { mode: "all", routeId: null }
        : { mode: route.mode, routeId: route.id },
    );
    router.push("/");
  }

  return (
    <SafeAreaView style={styles.screen} edges={["top"]}>
      <Text style={styles.kicker}>Réseau TaM</Text>
      <Text style={styles.title}>Lignes</Text>
      <Text style={styles.status}>
        {error ? error : updatedAt ? `Positions à ${formatClock(updatedAt)}` : "Connexion au flux TaM…"}
      </Text>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Rechercher une ligne"
        placeholderTextColor={palette.muted}
        style={styles.search}
        autoCorrect={false}
        clearButtonMode="while-editing"
      />
      <SectionList
        sections={sections}
        keyExtractor={(route) => route.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshing={refreshing}
        onRefresh={async () => {
          setRefreshing(true);
          await refresh();
          setRefreshing(false);
        }}
        renderSectionHeader={({ section }) => <Text style={styles.section}>{section.title}</Text>}
        renderItem={({ item }) => {
          const count = counts.get(item.id) ?? 0;
          const active = filter.routeId === item.id;
          return (
            <Pressable onPress={() => openRoute(item)} style={[styles.row, active && styles.rowActive]}>
              <View style={[styles.badge, { backgroundColor: item.color }]}>
                <Text style={[styles.badgeText, { color: item.textColor }]}>{item.shortName}</Text>
              </View>
              <View style={styles.copy}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.longName}
                </Text>
                <Text style={styles.meta}>{count === 0 ? "aucun véhicule" : `${count} en ligne`}</Text>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={<Text style={styles.empty}>Aucune ligne ne correspond.</Text>}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: palette.bg,
    paddingHorizontal: 16,
  },
  kicker: {
    color: palette.muted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    fontSize: 12,
    marginTop: 8,
  },
  title: {
    color: palette.text,
    fontSize: 32,
    fontWeight: "700",
  },
  status: {
    color: palette.muted,
    marginBottom: 12,
  },
  search: {
    backgroundColor: palette.panelSolid,
    color: palette.text,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 120,
    gap: 8,
  },
  section: {
    color: palette.muted,
    fontSize: 13,
    fontWeight: "700",
    marginTop: 14,
    marginBottom: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
  },
  rowActive: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
  },
  badge: {
    minWidth: 48,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  badgeText: {
    fontWeight: "800",
    fontSize: 15,
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  name: {
    color: palette.text,
    fontSize: 15,
    fontWeight: "600",
  },
  meta: {
    color: palette.muted,
    fontSize: 12,
  },
  empty: {
    color: palette.muted,
    marginTop: 24,
  },
});
