import { Tabs, TabList, TabSlot, TabTrigger, type TabTriggerSlotProps } from "expo-router/ui";
import type { ComponentProps } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { palette } from "@/constants/theme";

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: "100%" }} />
      <TabList asChild>
        <View style={styles.bar}>
          <TabTrigger name="carte" href="/" asChild>
            <TabButton>Carte</TabButton>
          </TabTrigger>
          <TabTrigger name="amigo" href="/amigo" asChild>
            <TabButton>Amigo</TabButton>
          </TabTrigger>
          <TabTrigger name="trajet" href="/trajet" asChild>
            <TabButton>Trajet</TabButton>
          </TabTrigger>
          <TabTrigger name="lignes" href="/lignes" asChild>
            <TabButton>Lignes</TabButton>
          </TabTrigger>
        </View>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable
      {...(props as ComponentProps<typeof Pressable>)}
      style={[styles.button, isFocused && styles.buttonActive]}>
      <Text style={[styles.label, isFocused && styles.labelActive]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 16,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  button: {
    backgroundColor: palette.panelSolid,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 999,
  },
  buttonActive: {
    backgroundColor: palette.blue,
  },
  label: {
    color: palette.text,
    fontWeight: "700",
  },
  labelActive: {
    color: "#FFFFFF",
  },
});
