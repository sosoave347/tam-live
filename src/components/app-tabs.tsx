import { NativeTabs } from "expo-router/native-tabs";

import { usePalette } from "@/lib/appearance";

export default function AppTabs() {
  const palette = usePalette();
  return (
    <NativeTabs
      backgroundColor={palette.tab}
      indicatorColor={palette.fill}
      iconColor={{ default: palette.muted, selected: palette.blue }}
      labelStyle={{
        default: { color: palette.muted },
        selected: { color: palette.blue },
      }}
      tintColor={palette.blue}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Carte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="amigo" hidden />
      <NativeTabs.Trigger name="trajet">
        <NativeTabs.Trigger.Label>Trajet</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="figure.walk" md="directions_walk" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="lignes">
        <NativeTabs.Trigger.Label>Lignes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="format_list_bulleted" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
