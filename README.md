# BillSplitterW

A fast, minimalist, mobile-first Split Bill Web App (PWA) designed for everyday group dining—built with Next.js (App Router, TypeScript), Tailwind CSS, `@google/genai`, Supabase (Postgres + Google Sign-In), and Vitest.

## Features

- **Zero Login Wall (Guest Mode):** Open straight into **Manual Split** or **Try Sample Receipt**—active bills and payment info auto-save locally in `localStorage`.
- **Login Mode (Google Sign-In via Supabase):** Sign in anytime to unlock **AI Receipt Scanning** (DB-backed `10 scans/day` per account with live remaining counter), **Saved Split History**, **Synced Payment Info** across devices, **Saved Frequent Friends**, **Paid/Unpaid Settlement Tracking**, and **Shareable Read-Only Bill Links** (`/bill/[slug]`).
- **Privacy-First Receipt OCR (`POST /api/scan-receipt`):**
  - Requires an authenticated Supabase user (`401 AUTH_REQUIRED` for unauthenticated requests) with strict DB-backed daily per-user quota (`public.scan_usage`, `10/day`, configurable in `src/lib/config.ts`) and automatic in-memory fallback.
  - Client-side EXIF orientation handling, thermal-receipt grayscale contrast boost, HTML Canvas resize (`max width 1280px`), and JPEG compression (`0.75` quality, `< 2 MB`)—raw photos are discarded immediately after extraction.
  - Server-side MIME + magic-byte + 2 MB validation, two-tier SHA-256 deduplication cache (memory + Supabase `public.ocr_cache` 24h TTL), and `@google/genai` (`gemini-3.5-flash-lite`) Structured JSON Output with `ThinkingLevel.MINIMAL`.
  - Graceful fallback into Manual Entry if `GEMINI_API_KEY` is missing, rate-limited (`429`), or parsing fails.
- **4-Step Fast Workflow:**
  1. **Capture / Manual / Sample Receipt** (live remaining scan quota badge + Indonesian restaurant sample receipt + offline PWA shell via `public/sw.js`).
  2. **Review & Fix** (inline editing with **Undo** toast on delete, 1-tap **Split Qty**, quick **+10% PB1 / +11% PPN / +5% / +7% Service** chips, and automatic receipt math check banner).
  3. **Add People & Assign** (colored participant chips, saved friends, **Paid by** selector, **Split all equally** & **Assign remaining to** shortcuts, tap-to-assign, and optional unequal custom shares like `2:1` portions).
  4. **Final Breakdown & Share** (per-person cards with **Paid / Unpaid** checklist, individual **Copy / WhatsApp Nudge**, optional friendly **Round-Up** pills, 1-tap **Save PNG Card**, collapsible auto-filled Payment Info, **Copy Summary** + **Open in WhatsApp**, **Undo** on reset, **Reuse** past group from History, and read-only `/bill/[slug]` links with 1-tap **Copy Account Number**).
- **Multi-Currency:** Default `IDR` (`Rp 45.000`, zero decimals) + quick switcher for `USD`, `SGD`, `MYR`, `EUR`, and `JPY`.
- **Exact Math Engine (`src/lib/split-engine.ts`):** Minor-unit arithmetic with largest-remainder rounding guarantees individual totals always sum exactly to the grand total.

---

## Local Development

```bash
npm install
cp .env.example .env.local
npm run dev
```

Run unit tests & production build check:

```bash
npm test
npm run build
```

---

## Environment Variables (Vercel & Local)

| Variable | Required | Where | Purpose |
| --- | --- | --- | --- |
| `GEMINI_API_KEY` | For OCR scan | Server-only | Enables `/api/scan-receipt` via Google AI Studio (`@google/genai`). App gracefully falls back to Manual Mode & Sample Receipt if omitted. |
| `NEXT_PUBLIC_SUPABASE_URL` | For Login Mode | Client + Server | Your Supabase Project URL (`https://<ref>.supabase.co`). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | For Login Mode | Client + Server | Your Supabase anon / publishable key. |

---

## Supabase & Google Sign-In Setup

1. **Apply the Database Migrations:**
   - Because this repo includes migrations under `supabase/migrations/` (`20261127000000_init_bill_splitter.sql`, `20261127010000_scan_quota_and_settlements.sql`, and `20261127020000_ocr_cache.sql`), Supabase's GitHub Integration applies them automatically on merge—or paste each SQL file in order into **Supabase Dashboard → SQL Editor → Run**.
2. **Enable Google OAuth in Supabase:**
   - In Google Cloud Console → **APIs & Services → Credentials → Create OAuth Client ID (Web application)**:
     - Authorized redirect URI: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Paste the Google **Client ID** and **Client Secret** into **Supabase Dashboard → Authentication → Providers → Google**.
   - In **Supabase Dashboard → Authentication → URL Configuration**:
     - Set **Site URL** to your production Vercel URL (e.g. `https://bill-splitter-w.vercel.app`).
     - Add Redirect URLs: `https://bill-splitter-w.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
3. **Deploy to Vercel:**
   - Import `chryow/BillSplitterW` in Vercel, add `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables**, and deploy.
