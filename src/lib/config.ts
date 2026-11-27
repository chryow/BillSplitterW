// Central application configuration constants

export const GEMINI_MODEL = "gemini-3.5-flash-lite";

export const MAX_SCANS_PER_DAY = 10;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export const CANVAS_MAX_WIDTH = 1280;
export const CANVAS_JPEG_QUALITY = 0.75;

export const RECEIPT_CACHE_MAX_ENTRIES = 200;
export const RECEIPT_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

// Curated stationery ink pigments (high contrast on unbleached paper & night ink)
export const PARTICIPANT_COLORS = [
  "#234E3D", // Fountain Pen Green
  "#C83E2B", // Stamp Vermilion
  "#2B4C7E", // Indigo Ink
  "#8F5B14", // Ochre Sepia
  "#6D3B5E", // Plum Ink
  "#2A6B6E", // Slate Teal
  "#8B4229", // Burnt Terracotta
  "#4A4E69", // Graphite Blue
] as const;

export const DEFAULT_QUICK_NAMES = ["You", "Budi", "Sari", "Dimas", "Nadia", "Raka"] as const;
