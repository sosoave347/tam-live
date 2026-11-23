export const palette = {
  ink: "#071018",
  panel: "rgba(7, 16, 24, 0.94)",
  panelSolid: "#101820",
  text: "#F4F7FB",
  muted: "#93A0B4",
  danger: "#FF8B7B",
} as const;

export const Colors = {
  light: {
    text: palette.text,
    background: palette.ink,
    backgroundElement: palette.panelSolid,
    backgroundSelected: "#1C2A3A",
    textSecondary: palette.muted,
  },
  dark: {
    text: palette.text,
    background: palette.ink,
    backgroundElement: palette.panelSolid,
    backgroundSelected: "#1C2A3A",
    textSecondary: palette.muted,
  },
} as const;
