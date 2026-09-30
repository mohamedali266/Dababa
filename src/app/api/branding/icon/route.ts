import { NextResponse } from "next/server";
import { buildBrandIconSvg, getBrandingSettings } from "@/lib/branding";

export async function GET() {
  const branding = await getBrandingSettings();
  return new NextResponse(buildBrandIconSvg(branding), {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300, stale-while-revalidate=86400"
    }
  });
}
