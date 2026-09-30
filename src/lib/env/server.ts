import "server-only";
import { z } from "zod";
import { getSupabasePublicEnv } from "./public";

const serverSupabaseEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required.")
});

export type ServerSupabaseEnv = {
  url: string;
  anonKey: string;
  serviceRoleKey: string;
};

export function getSupabaseServerEnv(): ServerSupabaseEnv {
  const publicEnv = getSupabasePublicEnv();
  const parsed = serverSupabaseEnvSchema.safeParse({
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((issue) => issue.message).join(" "));
  }

  return {
    ...publicEnv,
    serviceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY
  };
}
