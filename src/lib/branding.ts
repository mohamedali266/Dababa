import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type BrandingSettings = {
  appName: string;
  shortName: string;
  iconLetter: string;
  themeColor: string;
  backgroundColor: string;
  iconBackground: string;
  iconForeground: string;
};

export const defaultBranding: BrandingSettings = {
  appName: "Dababa",
  shortName: "Dababa",
  iconLetter: "D",
  themeColor: "#050A18",
  backgroundColor: "#050A18",
  iconBackground: "#2F6BFF",
  iconForeground: "#FFFFFF"
};

const hexColorPattern = /^#[0-9A-Fa-f]{6}$/;

function readString(value: unknown, fallback: string, maxLength = 80) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLength) : fallback;
}

function readColor(value: unknown, fallback: string) {
  return typeof value === "string" && hexColorPattern.test(value) ? value.toUpperCase() : fallback;
}

export function normalizeBranding(value: unknown): BrandingSettings {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    appName: readString(source.appName, defaultBranding.appName, 72),
    shortName: readString(source.shortName, defaultBranding.shortName, 18),
    iconLetter: readString(source.iconLetter, defaultBranding.iconLetter, 2).toUpperCase(),
    themeColor: readColor(source.themeColor, defaultBranding.themeColor),
    backgroundColor: readColor(source.backgroundColor, defaultBranding.backgroundColor),
    iconBackground: readColor(source.iconBackground, defaultBranding.iconBackground),
    iconForeground: readColor(source.iconForeground, defaultBranding.iconForeground)
  };
}

export async function getBrandingSettings(): Promise<BrandingSettings> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", "branding").maybeSingle();
    if (error) return defaultBranding;
    return normalizeBranding(data?.value);
  } catch {
    return defaultBranding;
  }
}

export function buildBrandIconSvg(branding: BrandingSettings) {
  const letter = branding.iconLetter.replace(/[<>&]/g, "");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" role="img" aria-label="${branding.shortName}"><rect width="512" height="512" rx="112" fill="${branding.iconBackground}"/><path d="M128 337L210 96h100l-48 132h122L235 416l39-126H128z" fill="${branding.iconForeground}" opacity="0.24"/><text x="256" y="318" text-anchor="middle" font-family="Arial, sans-serif" font-size="188" font-weight="900" fill="${branding.iconForeground}">${letter}</text></svg>`;
}
