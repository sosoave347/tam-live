import { Platform } from "react-native";

export const palette = {
  bg: "#F2F2F7",
  ink: "#1C1C1E",
  text: "#1C1C1E",
  muted: "#8E8E93",
  panel: "rgba(255,255,255,0.96)",
  panelSolid: "#FFFFFF",
  card: "#FFFFFF",
  blue: "#007AFF",
  danger: "#FF3B30",
  warn: "#FF9500",
  ok: "#34C759",
  line: "rgba(60,60,67,0.12)",
  fill: "#E5E5EA",
} as const;

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
    text: palette.text,
    background: palette.bg,
    backgroundElement: palette.card,
    backgroundSelected: "#E5F0FF",
    textSecondary: palette.muted,
  },
  dark: {
    text: palette.text,
    background: palette.bg,
    backgroundElement: palette.card,
    backgroundSelected: "#E5F0FF",
    textSecondary: palette.muted,
  },
} as const;
