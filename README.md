# BillSplitterW

A fast, minimalist, mobile-first Split Bill Web App (PWA) designed for everyday group dining—built with Next.js (App Router, TypeScript), Tailwind CSS, `@google/genai`, Supabase (Postgres + Google Sign-In), and Vitest.

## Features

- **Zero Login Wall (Guest Mode):** Open straight into **Manual Split** or **Try Sample Receipt**—active bills and payment info auto-save locally in `localStorage`.
- **Login Mode (Google Sign-In via Supabase):** Sign in anytime to unlock **AI Receipt Scanning** (`10 scans/day` per account), **Saved Split History**, **Synced Payment Info** across devices, **Saved Frequent Friends**, and **Shareable Read-Only Bill Links** (`/bill/[slug]`).
- **Privacy-First Receipt OCR (`POST /api/scan-receipt`):**
  - Requires an authenticated Supabase user (`401 AUTH_REQUIRED` for unauthenticated requests) with per-user daily rate limiting (`10/day`, configurable in `src/lib/config.ts`).
  - Client-side HTML Canvas resize (`max width 1280px`) and JPEG compression (`0.75` quality, `< 2 MB`)—raw photos are discarded immediately after extraction.
  - Server-side MIME + magic-byte + 2 MB validation, SHA-256 deduplication cache, and `@google/genai` (`gemini-3.5-flash-lite`) Structured JSON Output with `ThinkingLevel.MINIMAL`.
  - Graceful fallback into Manual Entry if `GEMINI_API_KEY` is missing, rate-limited (`429`), or parsing fails.
- **4-Step Fast Workflow:**
  1. **Capture / Manual / Sample Receipt** (Indonesian restaurant sample with PB1, service charge, discount, and multi-qty items).
  2. **Review & Fix** (inline editing, 1-tap **Split Qty** for `qty > 1` items, automatic receipt math check banner).
  3. **Add People & Assign** (colored participant chips, saved friends, tap-to-assign, **Split All**, automatic proportional tax/service/discount).
  4. **Final Breakdown & Share** (per-person cards, collapsible auto-filled Payment Info, 1-tap **Copy WhatsApp Summary**, and optional share link).
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

1. **Apply the Database Migration:**
   - Because this repo includes `supabase/migrations/20261127000000_init_bill_splitter.sql`, Supabase's GitHub Integration applies it automatically on merge—or paste the SQL once into **Supabase Dashboard → SQL Editor → Run**.
2. **Enable Google OAuth in Supabase:**
   - In Google Cloud Console → **APIs & Services → Credentials → Create OAuth Client ID (Web application)**:
     - Authorized redirect URI: `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`
   - Paste the Google **Client ID** and **Client Secret** into **Supabase Dashboard → Authentication → Providers → Google**.
   - In **Supabase Dashboard → Authentication → URL Configuration**:
     - Set **Site URL** to your production Vercel URL (e.g. `https://bill-splitter-w.vercel.app`).
     - Add Redirect URLs: `https://bill-splitter-w.vercel.app/auth/callback` and `http://localhost:3000/auth/callback`.
3. **Deploy to Vercel:**
   - Import `chryow/BillSplitterW` in Vercel, add `GEMINI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY` under **Project Settings → Environment Variables**, and deploy.
