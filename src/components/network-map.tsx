import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import { useRouter } from "expo-router";
import MapView, { Marker, Polyline, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterBar } from "@/components/filter-bar";
import { VehicleSheet } from "@/components/vehicle-sheet";
import { type Palette } from "@/constants/theme";
import { useAppearance, useStyles } from "@/lib/appearance";
import { useFavorites } from "@/lib/favorites";
import { inMetropole, readableAddress } from "@/lib/geocode";
import { isStale } from "@/lib/format";
import type { LiveVehicle } from "@/lib/gtfs-rt";
import { useJourney } from "@/lib/journey";
import { useLive } from "@/lib/live";
import { useUserLocation } from "@/lib/location";
import { routeFor } from "@/lib/network";
import { usePick } from "@/lib/pick";
import { usePlaces } from "@/lib/places";
import { busRouteIds, routeColor, routePaths, stopsAlong, tramRouteIds } from "@/lib/shapes";

const MONTPELLIER: Region = {
  latitude: 43.6109,
  longitude: 3.8767,
  latitudeDelta: 0.22,
  longitudeDelta: 0.22,
};

const DARK_MAP = [
  { elementType: "geometry", stylers: [{ color: "#0d1b2a" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8ea0b5" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0d1b2a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1b3148" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#071018" }] },
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", stylers: [{ visibility: "off" }] },
];

export function NetworkMap() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const styles = useStyles(createStyles);
  const { scheme } = useAppearance();
  const mapRef = useRef<MapView>(null);
  const fitted = useRef("");
  const center = useRef({ latitude: MONTPELLIER.latitude, longitude: MONTPELLIER.longitude });
  const { visible, filter, setFilter, selectedId, setSelectedId } = useLive();
  const { coords, granted } = useUserLocation();
  const { home, work, focus, clearFocus } = usePlaces();
  const { journey, setJourney } = useJourney();
  const pick = usePick();
  const { ids: savedIds } = useFavorites();
  const [trackMarkers, setTrackMarkers] = useState(true);
  const [followsUser, setFollowsUser] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [pinMessage, setPinMessage] = useState<string | null>(null);

  useEffect(() => {
    setTrackMarkers(true);
    const timer = setTimeout(() => setTrackMarkers(false), 700);
    return () => clearTimeout(timer);
  }, [visible, selectedId, filter.routeId]);

  useEffect(() => {
    if (pick.role || !mapRef.current || !filter.routeId) return;
    const points = routePaths(filter.routeId).flat();
    if (points.length === 0) return;
    const key = `shape:${filter.routeId}`;
    if (fitted.current === key) return;
    fitted.current = key;
    mapRef.current.fitToCoordinates(points.filter((_, index) => index % 6 === 0), {
      edgePadding: { top: 180, right: 40, bottom: 220, left: 40 },
      animated: true,
    });
  }, [filter.routeId, pick.role]);

  useEffect(() => {
    const key = `${filter.mode}:${filter.routeId ?? "all"}`;
    if (pick.role || !mapRef.current || filter.routeId || visible.length === 0 || fitted.current === key) return;
    fitted.current = key;
    fitTo(mapRef.current, visible);
  }, [visible, filter.mode, filter.routeId, pick.role]);

  useEffect(() => {
    if (pick.role || !focus || !mapRef.current) return;
    mapRef.current.animateToRegion(focus);
    clearFocus();
  }, [focus, clearFocus, pick.role]);

  useEffect(() => {
    if (!pick.role || !mapRef.current) return;
    const saved = pick.role === "origin" ? pick.origin : pick.destination;
    const target = saved ?? coords;
    if (!target) return;
    mapRef.current.animateToRegion({
      latitude: target.latitude,
      longitude: target.longitude,
      latitudeDelta: 0.012,
      longitudeDelta: 0.012,
    });
  }, [pick.role]);

  async function acceptPin() {
    const { latitude, longitude } = center.current;
    if (!inMetropole(latitude, longitude)) {
      setPinMessage("Hors métropole");
      return;
    }
    setPinMessage(null);
    setPlacing(true);
    try {
      const address = await readableAddress(latitude, longitude, "Point sur la carte");
      pick.confirm({ address, latitude, longitude });
      router.push("/amigo");
    } finally {
      setPlacing(false);
    }
  }

  async function centerOnMe() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== "granted") return;
    const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    setFollowsUser(true);
    mapRef.current?.animateToRegion({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
  }

  function showNetwork() {
    fitted.current = `${filter.mode}:${filter.routeId ?? "all"}`;
    setFollowsUser(false);
    if (!mapRef.current || visible.length === 0) {
      mapRef.current?.animateToRegion(MONTPELLIER);
      return;
    }
    fitTo(mapRef.current, visible);
  }

  return (
    <View style={styles.fill}>
      <MapView
        ref={mapRef}
        style={styles.fill}
        initialRegion={MONTPELLIER}
        userInterfaceStyle={scheme === "dark" ? "dark" : "light"}
        customMapStyle={scheme === "dark" && Platform.OS === "android" ? DARK_MAP : undefined}
        showsUserLocation={granted || followsUser}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        onPanDrag={() => setFollowsUser(false)}
        onRegionChange={(region) => {
          center.current = { latitude: region.latitude, longitude: region.longitude };
        }}>
        {traceIds(filter, journey?.itinerary.legs.map((leg) => leg.routeId) ?? [], savedIds).map((routeId) =>
          routePaths(routeId).map((coordinates, index) => (
            <Polyline
              key={`${routeId}-${index}`}
              coordinates={coordinates}
              strokeColor={routeColor(routeId)}
              strokeWidth={filter.routeId === routeId || journey?.itinerary.legs.some((leg) => leg.routeId === routeId) ? 6 : 3}
              tappable
              onPress={() => {
                const route = routeFor(routeId);
                setSelectedId(null);
                setFilter({ mode: route?.mode ?? "bus", routeId });
              }}
            />
          )),
        )}
        {filter.routeId
          ? stopsAlong(filter.routeId).map((stop) => (
              <Marker key={`stop-${filter.routeId}-${stop.latitude}-${stop.longitude}`} coordinate={stop} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={trackMarkers}>
                <View style={[styles.stopDot, { borderColor: routeColor(filter.routeId ?? "") }]} />
              </Marker>
            ))
          : null}
        {home ? (
          <Marker
            coordinate={{ latitude: home.latitude, longitude: home.longitude }}
            title="Domicile"
            description={home.address}
            pinColor="#007AFF"
          />
        ) : null}
        {journey ? (
          <Marker
            coordinate={journey.destination}
            title="Arrivée"
            description={journey.destination.address}
            pinColor="#FF3B30"
          />
        ) : null}
        {work ? (
          <Marker
            coordinate={{ latitude: work.latitude, longitude: work.longitude }}
            title="Travail"
            description={work.address}
            pinColor="#F5C16C"
          />
        ) : null}
        {visible.map((vehicle) => (
          <VehicleMarker
            key={vehicle.id}
            vehicle={vehicle}
            selected={vehicle.id === selectedId}
            tracksViewChanges={trackMarkers}
            onPress={() => setSelectedId(vehicle.id)}
          />
        ))}
      </MapView>

      {pick.role ? <View pointerEvents="none" style={styles.reticle} /> : null}
      <View style={[styles.overlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        {pick.role ? (
          <View style={styles.pickCard}>
            <Text style={styles.pickTitle}>{pick.role === "origin" ? "Départ" : "Arrivée"}</Text>
            <Text style={styles.pickHint}>{pinMessage ?? "Déplace la carte"}</Text>
          </View>
        ) : (
          <FilterBar />
        )}
        <View pointerEvents="box-none" style={[styles.bottom, { marginBottom: insets.bottom + 72 }]}>
          <View style={styles.tools}>
            <Pressable style={styles.tool} onPress={centerOnMe}>
              <Text style={styles.toolText}>Moi</Text>
            </Pressable>
            {pick.role ? (
              <>
                <Pressable
                  style={styles.tool}
                  onPress={() => {
                    pick.cancel();
                    router.push("/amigo");
                  }}>
                  <Text style={styles.toolText}>Annuler</Text>
                </Pressable>
                <Pressable style={styles.tool} onPress={acceptPin} disabled={placing}>
                  {placing ? <ActivityIndicator /> : <Text style={styles.toolText}>OK</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <Pressable style={styles.tool} onPress={showNetwork}>
                  <Text style={styles.toolText}>Réseau</Text>
                </Pressable>
                {journey ? (
                  <Pressable style={styles.tool} onPress={() => setJourney(null)}>
                    <Text style={styles.toolText}>Effacer</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
          {pick.role || !selectedId ? null : <VehicleSheet />}
        </View>
      </View>
    </View>
  );
}

function traceIds(filter: { mode: string; routeId: string | null }, extra: string[], saved: string[]) {
  const ids = new Set<string>(extra);
  if (filter.routeId) ids.add(filter.routeId);
  else if (filter.mode === "bus") busRouteIds().forEach((id) => ids.add(id));
  else if (filter.mode === "saved") saved.forEach((id) => ids.add(id));
  else tramRouteIds().forEach((id) => ids.add(id));
  return [...ids];
}

function fitTo(map: MapView, vehicles: LiveVehicle[]) {
  if (vehicles.length === 1) {
    const [vehicle] = vehicles;
    map.animateToRegion({
      latitude: vehicle.latitude,
      longitude: vehicle.longitude,
      latitudeDelta: 0.03,
      longitudeDelta: 0.03,
    });
    return;
  }
  map.fitToCoordinates(
    vehicles.map((vehicle) => ({ latitude: vehicle.latitude, longitude: vehicle.longitude })),
    { edgePadding: { top: 230, right: 48, bottom: 230, left: 48 }, animated: true },
  );
}

function VehicleMarker({
  vehicle,
  selected,
  tracksViewChanges,
  onPress,
}: {
  vehicle: LiveVehicle;
  selected: boolean;
  tracksViewChanges: boolean;
  onPress: () => void;
}) {
  const styles = useStyles(createStyles);
  const route = routeFor(vehicle.routeId);
  const color = route?.color ?? "#8B93A7";

  return (
    <Marker
      coordinate={{ latitude: vehicle.latitude, longitude: vehicle.longitude }}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={tracksViewChanges}
      onPress={onPress}
      zIndex={selected ? 10 : 1}>
      <View style={[styles.marker, isStale(vehicle.timestamp) && styles.stale]} collapsable={false}>
        {vehicle.bearing != null ? (
          <View
            style={[
              styles.arrow,
              {
                borderBottomColor: color,
                transform: [{ rotate: `${vehicle.bearing}deg` }],
              },
            ]}
          />
        ) : null}
        <View style={[styles.pill, { backgroundColor: color }, selected && styles.pillSelected]}>
          <Text style={[styles.pillText, { color: route?.textColor ?? "#FFFFFF" }]}>
            {route?.shortName ?? vehicle.routeId ?? "?"}
          </Text>
        </View>
      </View>
    </Marker>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  bottom: {
    gap: 8,
  },
  tools: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginRight: 12,
  },
  tool: {
    backgroundColor: palette.panel,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  toolText: {
    color: palette.text,
    fontWeight: "700",
    fontSize: 13,
  },
  marker: {
    alignItems: "center",
  },
  stale: {
    opacity: 0.45,
  },
  arrow: {
    width: 0,
    height: 0,
    marginBottom: 2,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderBottomWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
  pill: {
    minWidth: 28,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    alignItems: "center",
  },
  pillSelected: {
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "800",
  },
  stopDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
  },
  appearance: {
    width: 220,
    alignSelf: "flex-end",
    marginRight: 12,
  },
  pickCard: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: palette.panel,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 2,
  },
  pickTitle: {
    color: palette.text,
    fontSize: 22,
    fontWeight: "700",
  },
  pickHint: {
    color: palette.muted,
    fontSize: 13,
  },
  reticle: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 28,
    height: 28,
    marginLeft: -14,
    marginTop: -28,
    borderRadius: 14,
    backgroundColor: palette.blue,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    zIndex: 2,
  },
  });
}
