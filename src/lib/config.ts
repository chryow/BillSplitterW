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

// Curated participant badge accents (high contrast on both dark charcoal & light surfaces)
export const PARTICIPANT_COLORS = [
  "#10B981", // Emerald
  "#38BDF8", // Sky
  "#F59E0B", // Amber
  "#FB7185", // Rose
  "#14B8A6", // Teal
  "#FB923C", // Orange
  "#60A5FA", // Blue
  "#84CC16", // Lime
] as const;

export const DEFAULT_QUICK_NAMES = ["You", "Budi", "Sari", "Dimas", "Nadia", "Raka"] as const;
