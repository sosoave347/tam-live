import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { type Palette } from "@/constants/theme";
import { usePalette, useStyles } from "@/lib/appearance";
import { useUserLocation } from "@/lib/location";
import { usePlaces, type SavedPlace } from "@/lib/places";

export function PlaceCard({ kind, title, place }: { kind: "home" | "work"; title: string; place: SavedPlace | null }) {
  const styles = useStyles(createStyles);
  const palette = usePalette();
  const { coords } = useUserLocation();
  const { saveAddress, saveHere, clearPlace } = usePlaces();
  const [draft, setDraft] = useState(place?.address ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (place?.address) setDraft(place.address);
  }, [place?.address]);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.place}>
      <View style={styles.head}>
        <Text style={styles.title}>{title}</Text>
        {place ? (
          <Pressable onPress={() => clearPlace(kind)}>
            <Text style={styles.link}>Effacer</Text>
          </Pressable>
        ) : null}
      </View>
      <TextInput
        value={draft}
        onChangeText={setDraft}
        placeholder="Adresse"
        placeholderTextColor={palette.muted}
        style={styles.input}
        autoCorrect={false}
      />
      <View style={styles.actions}>
        <Pressable style={styles.primary} disabled={busy} onPress={() => run(() => saveAddress(kind, draft, coords ?? undefined))}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryText}>OK</Text>}
        </Pressable>
        <Pressable style={styles.secondary} disabled={busy} onPress={() => run(() => saveHere(kind))}>
          <Text style={styles.secondaryText}>Ici</Text>
        </Pressable>
      </View>
      {message ? <Text style={styles.error}>{message}</Text> : null}
    </View>
  );
}

function createStyles(palette: Palette) {
  return StyleSheet.create({
    place: { gap: 10 },
    head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    title: { color: palette.text, fontSize: 16, fontWeight: "700" },
    link: { color: palette.blue, fontWeight: "600" },
    input: {
      backgroundColor: palette.fill,
      color: palette.text,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 12,
      fontSize: 16,
    },
    actions: { flexDirection: "row", gap: 8 },
    primary: {
      backgroundColor: palette.blue,
      borderRadius: 999,
      paddingHorizontal: 16,
      paddingVertical: 10,
      minWidth: 72,
      alignItems: "center",
    },
    primaryText: { color: "#FFFFFF", fontWeight: "700" },
    secondary: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: palette.fill },
    secondaryText: { color: palette.text, fontWeight: "700" },
    error: { color: palette.danger, fontSize: 13 },
  });
}
