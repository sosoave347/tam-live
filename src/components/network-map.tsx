import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Location from "expo-location";
import MapView, { Marker, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { FilterBar } from "@/components/filter-bar";
import { MapGlance } from "@/components/map-glance";
import { VehicleSheet } from "@/components/vehicle-sheet";
import { palette } from "@/constants/theme";
import { isStale } from "@/lib/format";
import type { LiveVehicle } from "@/lib/gtfs-rt";
import { useLive } from "@/lib/live";
import { useUserLocation } from "@/lib/location";
import { routeFor } from "@/lib/network";
import { usePlaces } from "@/lib/places";

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
  const mapRef = useRef<MapView>(null);
  const fitted = useRef("");
  const { visible, filter, selectedId, setSelectedId } = useLive();
  const { granted } = useUserLocation();
  const { home, work, focus, clearFocus } = usePlaces();
  const [trackMarkers, setTrackMarkers] = useState(true);
  const [followsUser, setFollowsUser] = useState(false);

  useEffect(() => {
    setTrackMarkers(true);
    const timer = setTimeout(() => setTrackMarkers(false), 700);
    return () => clearTimeout(timer);
  }, [visible, selectedId]);

  useEffect(() => {
    const key = `${filter.mode}:${filter.routeId ?? "all"}`;
    if (!mapRef.current || visible.length === 0 || fitted.current === key) return;
    fitted.current = key;
    fitTo(mapRef.current, visible);
  }, [visible, filter.mode, filter.routeId]);

  useEffect(() => {
    if (!focus || !mapRef.current) return;
    mapRef.current.animateToRegion(focus);
    clearFocus();
  }, [focus, clearFocus]);

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
        customMapStyle={Platform.OS === "android" ? DARK_MAP : undefined}
        showsUserLocation={granted || followsUser}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        rotateEnabled={false}
        onPanDrag={() => setFollowsUser(false)}>
        {home ? (
          <Marker
            coordinate={{ latitude: home.latitude, longitude: home.longitude }}
            title="Domicile"
            description={home.address}
            pinColor="#F4F7FB"
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

      <View style={[styles.overlay, { paddingTop: insets.top }]} pointerEvents="box-none">
        <FilterBar />
        <View pointerEvents="box-none" style={[styles.bottom, { marginBottom: insets.bottom + 72 }]}>
          <View style={styles.tools}>
            <Pressable style={styles.tool} onPress={centerOnMe}>
              <Text style={styles.toolText}>Moi</Text>
            </Pressable>
            <Pressable style={styles.tool} onPress={showNetwork}>
              <Text style={styles.toolText}>Réseau</Text>
            </Pressable>
          </View>
          {selectedId ? <VehicleSheet /> : <MapGlance />}
        </View>
      </View>
    </View>
  );
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

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: palette.ink,
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
});
