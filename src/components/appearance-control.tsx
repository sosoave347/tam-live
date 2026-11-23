import { Pressable, Text, View } from "react-native";

import { useAppearance, type AppearanceMode } from "@/lib/appearance";

const OPTIONS: { id: AppearanceMode; label: string }[] = [
  { id: "system", label: "Auto" },
  { id: "light", label: "Clair" },
  { id: "dark", label: "Sombre" },
];

export function AppearanceControl() {
  const { mode, setMode, palette } = useAppearance();

  return (
    <View style={{ flexDirection: "row", backgroundColor: palette.fill, borderRadius: 12, padding: 3, gap: 3 }}>
      {OPTIONS.map((item) => {
        const selected = mode === item.id;
        return (
          <Pressable
            key={item.id}
            onPress={() => setMode(item.id)}
            style={{
              flex: 1,
              alignItems: "center",
              paddingVertical: 7,
              borderRadius: 10,
              backgroundColor: selected ? palette.elevated : "transparent",
            }}>
            <Text style={{ color: selected ? palette.text : palette.muted, fontSize: 13, fontWeight: "600" }}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
