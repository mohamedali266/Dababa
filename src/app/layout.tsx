import type { Metadata, Viewport } from "next";
import { Cairo, Sora } from "next/font/google";
import "./globals.css";

const cairo = Cairo({ subsets: ["arabic", "latin"], variable: "--font-arabic", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--font-latin", display: "swap" });

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
    const saved = localStorage.getItem("dababa-theme") || "dark";
    const system = window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    document.documentElement.dataset.theme = saved === "system" ? system : saved;
  } catch {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <body className={`${cairo.variable} ${sora.variable}`}>
        <script dangerouslySetInnerHTML={{ __html: themeBoot }} />
        {children}
      </body>
    </html>
  );
}


