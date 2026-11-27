/**
 * Centralized "Editorial E-Ink" design system tokens.
 * Mirrors CSS custom properties in `src/app/globals.css` and supplies
 * exact color/font constants for HTML Canvas exports (PNG split & trip cards).
 */
export const EDITORIAL_THEME = {
  appName: "BillSplitterW",
  version: "v1.0",
  authorHandle: "chryow",
  colophonLabel: "CRAFTED BY CHRYOW",
  colors: {
    paper: "#F7F5F0",
    surface: "#FFFFFF",
    pressedPaper: "#EFECE4",
    hoverPaper: "#E5E0D5",
    ink: "#1A1A18",
    graphite: "#6B6963",
    hairline: "#D8D4CA",
    strongBorder: "#1A1A18",
    vermilion: "#C83E2B",
    vermilionHover: "#A83222",
    fountainGreen: "#234E3D",
    ochre: "#8A4B14",
  },
  fonts: {
    serif: "'Newsreader', Georgia, 'Times New Roman', serif",
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  },
} as const;
