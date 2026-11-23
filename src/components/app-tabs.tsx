import { NativeTabs } from "expo-router/native-tabs";

import { palette } from "@/constants/theme";

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={palette.ink}
      indicatorColor="#1C2A3A"
      iconColor={{ default: palette.muted, selected: palette.text }}
      labelStyle={{
        default: { color: palette.muted },
        selected: { color: palette.text },
      }}
      tintColor={palette.text}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Carte</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="map.fill" md="map" />
      </NativeTabs.Trigger>
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
