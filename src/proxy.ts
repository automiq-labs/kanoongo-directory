import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Auth-gate proxy (runs as middleware).
 *
 * Four-state trace for /admin paths:
 *   1. Signed-out  + /admin/login  → ALLOW (page renders login form)
 *   2. Signed-out  + /admin        → redirect /login (standard signed-out bounce)
 *   3. Signed-in admin + /admin    → ALLOW (server page checks is_admin, renders)
 *   4. Signed-in non-admin + /admin → ALLOW at proxy level; server page.tsx
 *      calls is_admin, gets false, redirects to /admin/login?error=not_admin
 *
 *   Signed-in + /admin/login → ALLOW (non-admin needs to see the error page;
 *      admin can navigate away themselves — no harm)
 *
 * Register resilience:
 *   Signed-in user WITHOUT a families row → allowed on /register to complete
 *   registration. Signed-in WITH a family → bounced to / as before.
 */
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Pages accessible without sign-in
  const publicWhenSignedOut =
    pathname === "/login" ||
    pathname === "/register" ||
    pathname === "/reset-password" ||
    pathname === "/admin/login";

  // Pages that bounce signed-in users to / (NOT /admin/login — non-admins need it)
  const bounceWhenSignedIn =
    pathname === "/login" ||
    pathname === "/reset-password";

  // Signed-out + protected page → /login
  if (!user && !publicWhenSignedOut) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Signed-in + member auth pages → bounce to /
  // Special case: /register is only bounced if the user HAS a families row
  if (user && bounceWhenSignedIn) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // Signed-in + /register → check if they have a family; if yes, bounce
  if (user && pathname === "/register") {
    const { data: family } = await supabase
      .from("families")
      .select("id")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    if (family) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    // No family row → allow through to complete registration
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
