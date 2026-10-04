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
  response.headers.set("Cache-Control", "no-store");
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          response.headers.set("Cache-Control", "no-store");
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return area === "admin" ? redirectAdminLogin(request) : redirectToAuth(request);

  const { data: active } = await supabase.rpc("is_active_user");
  if (!active) return area === "admin" ? notFound() : redirectToAuth(request);

  if (area === "app") return response;

  const { data: isAdmin } = await supabase.rpc("is_platform_admin");
  if (isAdmin) return response;

  if (area === "admin") return notFound();

  const neededRole = area === "club" ? "owner" : "trainer";
  const { data: memberships } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("role", neededRole)
    .eq("status", "active")
    .limit(1);

  if (memberships && memberships.length > 0) return response;
  return redirectToAuth(request);
}

function resolveArea(pathname: string): Area | null {
  const found = Object.entries(protectedAreas).find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return found?.[1] ?? null;
}

function redirectToAuth(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/auth";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function redirectAdminLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/admin/login";
  url.searchParams.set("next", request.nextUrl.pathname);
  return NextResponse.redirect(url);
}

function notFound() {
  return new NextResponse(
    `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>غير مصرح بالدخول | Dababa</title>
  <style>
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f172a;color:#f8fafc;font-family:Arial,sans-serif}
    main{width:min(92vw,520px);padding:32px;border:1px solid rgba(248,250,252,.14);background:rgba(15,23,42,.92);box-shadow:0 24px 80px rgba(0,0,0,.35)}
    h1{margin:0 0 12px;font-size:26px}
    p{margin:0 0 22px;color:#cbd5e1;line-height:1.8}
    a{display:inline-flex;padding:12px 18px;background:#f8fafc;color:#0f172a;text-decoration:none;font-weight:700}
  </style>
</head>
<body>
  <main>
    <h1>غير مصرح بالدخول</h1>
    <p>هذه المنطقة مخصصة لإدارة المنصة فقط. محاولة الدخول بحساب غير مصرح قد تعرض الحساب للحظر النهائي.</p>
    <a href="/auth">الرجوع إلى الصفحة الرئيسية</a>
  </main>
</body>
</html>`,
    {
      status: 404,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
        "X-Robots-Tag": "noindex"
      }
    }
  );
}

export const config = {
  matcher: ["/app/:path*", "/club/:path*", "/trainer/:path*", "/admin/:path*"]
};

