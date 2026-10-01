import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const ibmPlexArabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["400", "500", "700"], variable: "--font-arabic", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Dababa", template: "%s · Dababa" },
  description: "Arabic-first fitness training, nutrition, hydration, supplements, and progress tracking.",
  manifest: "/api/manifest.webmanifest",
  icons: {
    icon: "/api/branding/icon",
    shortcut: "/api/branding/icon",
    apple: "/api/branding/icon"
  },
  appleWebApp: {
    capable: true,
    title: "Dababa",
    statusBarStyle: "black-translucent"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#050A18" },
    { media: "(prefers-color-scheme: light)", color: "#EAF1FF" }
  ]
};

const themeBoot = `
(() => {
  try {
    const saved = localStorage.getItem("dababa-theme") || "system";
    const system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = saved === "system" ? system : saved;
  } catch {
    document.documentElement.dataset.theme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="light" suppressHydrationWarning>
      <body className={ibmPlexArabic.variable}>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {children}
      </body>
    </html>
  );
}


