import { Platform } from "react-native";

const light = {
  bg: "#F2F2F7",
  ink: "#1C1C1E",
  text: "#1C1C1E",
  muted: "#8E8E93",
  panel: "rgba(255,255,255,0.96)",
  panelSolid: "#FFFFFF",
  card: "#FFFFFF",
  elevated: "#FFFFFF",
  blue: "#007AFF",
  danger: "#FF3B30",
  warn: "#FF9500",
  ok: "#34C759",
  line: "rgba(60,60,67,0.12)",
  fill: "#E5E5EA",
  selected: "rgba(0,122,255,0.12)",
  tab: "#F8F8F8",
};

const dark = {
  bg: "#000000",
  ink: "#FFFFFF",
  text: "#FFFFFF",
  muted: "#8E8E93",
  panel: "rgba(28,28,30,0.94)",
  panelSolid: "#1C1C1E",
  card: "#1C1C1E",
  elevated: "#3A3A3C",
  blue: "#0A84FF",
  danger: "#FF453A",
  warn: "#FF9F0A",
  ok: "#30D158",
  line: "rgba(255,255,255,0.12)",
  fill: "#2C2C2E",
  selected: "rgba(10,132,255,0.24)",
  tab: "#1C1C1E",
};

export const palettes = { light, dark };

export type Palette = { [K in keyof typeof light]: string };

export const palette = light;

export const cardShadow = Platform.select({
  ios: {
    shadowColor: "#000000",
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
  },
  default: { elevation: 4 },
});

export const Colors = {
  light: {
    text: light.text,
    background: light.bg,
    backgroundElement: light.card,
    backgroundSelected: light.selected,
    textSecondary: light.muted,
  },
  dark: {
    text: dark.text,
    background: dark.bg,
    backgroundElement: dark.card,
    backgroundSelected: dark.selected,
    textSecondary: dark.muted,
  },
} as const;
