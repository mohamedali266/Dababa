import { NextResponse } from "next/server";
import { getBrandingSettings } from "@/lib/branding";

export async function GET() {
  const branding = await getBrandingSettings();
  return NextResponse.json({
    name: branding.appName,
    short_name: branding.shortName,
    description: "Arabic-first gym operations, coaching, and athlete fitness platform.",
    lang: "ar",
    dir: "rtl",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: branding.backgroundColor,
    theme_color: branding.themeColor,
    icons: [
      { src: "/api/branding/icon", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
    ]
  }, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
