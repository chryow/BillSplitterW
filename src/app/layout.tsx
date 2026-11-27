import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { PwaRegistrar } from "@/components/PwaRegistrar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "BillSplitterW — Fast Mobile Receipt Split",
  description:
    "Scan any receipt, assign dishes with a tap, and copy a neat WhatsApp breakdown in seconds. Works in Guest Mode or sign in with Google to save history.",
  manifest: "/manifest.json",
  applicationName: "BillSplitterW",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "BillSplitterW",
  },
  icons: {
    icon: [
      { url: "/icons/icon.svg", type: "image/svg+xml" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0A0D12" },
    { media: "(prefers-color-scheme: light)", color: "#F3F5F8" },
  ],
};

// Inline script runs before paint to avoid dark->light flash when user toggled light mode
const themeBootstrapScript = `
(function() {
  try {
    var saved = localStorage.getItem('billsplitterw:theme:v1');
    var theme = saved === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="min-h-full bg-[var(--bg-app)] text-[var(--text-primary)] selection:bg-[var(--accent-soft)] selection:text-[var(--accent-text)]">
        <PwaRegistrar />
        {children}
      </body>
    </html>
  );
}
