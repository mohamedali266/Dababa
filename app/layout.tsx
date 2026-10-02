import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import "./globals.css";

const font = IBM_Plex_Sans_Arabic({ subsets: ["arabic"], weight: ["400", "500", "700"], display: "swap" });

export const metadata: Metadata = {
  title: "دبابة",
  description: "تمرين وتغذية ومتابعة تقدمك، ونادي بإدارة كاملة.",
  appleWebApp: { capable: true, title: "دبابة", statusBarStyle: "black-translucent" },
};
// No maximum-scale: users must be able to zoom.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#EAF1FF" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className={font.className}>{children}</body>
    </html>
  );
}
