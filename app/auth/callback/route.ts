import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedNext = new Set(["/", "/app", "/auth", "/auth/join", "/club", "/trainer", "/admin"]);

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedNext = url.searchParams.get("next") || "/app";
  const flow = url.searchParams.get("flow");
  const next = allowedNext.has(requestedNext) ? requestedNext : "/app";

  if (code) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  const redirectUrl = new URL(next, request.url);
  const response = NextResponse.redirect(redirectUrl);

  if (flow === "onboarding") {
    redirectUrl.pathname = "/auth";
    redirectUrl.search = "?flow=onboarding";
    const onboardingResponse = NextResponse.redirect(redirectUrl);
    onboardingResponse.cookies.set("dababa_oauth_flow", "onboarding", {
      path: "/",
      sameSite: "lax",
      secure: true,
      maxAge: 10 * 60
    });
    return onboardingResponse;
  }

  return response;
}
