import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Area = "app" | "club" | "trainer" | "admin";

const protectedAreas: Record<string, Area> = {
  "/app": "app",
  "/club": "club",
  "/trainer": "trainer",
  "/admin": "admin"
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const area = resolveArea(pathname);
  if (!area) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return redirectToAuth(request, area);

  const { data: active } = await supabase.rpc("is_active_user");
  if (!active) return redirectToAuth(request, area);

  if (area === "app") return response;

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin) return response;

  if (area === "admin") return redirectToAuth(request, area);

  const neededRole = area === "club" ? "owner" : "trainer";
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", neededRole)
    .eq("status", "active")
    .limit(1);

  if (memberships && memberships.length > 0) return response;
  return redirectToAuth(request, area);
}

function resolveArea(pathname: string): Area | null {
  const found = Object.entries(protectedAreas).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return found?.[1] ?? null;
}

function redirectToAuth(request: NextRequest, area: Area) {
  const url = request.nextUrl.clone();
  url.pathname = area === "admin" ? "/auth" : "/auth";
  url.searchParams.set("next", request.nextUrl.pathname);
  if (area === "admin") url.searchParams.set("security", "admin_required");
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/club/:path*", "/trainer/:path*", "/admin/:path*"]
};