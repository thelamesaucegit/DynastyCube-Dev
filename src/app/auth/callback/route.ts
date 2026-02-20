// src/app/auth/callback/route.ts
// Server-side OAuth callback handler
// Exchanges the auth code for a session and sets cookies properly
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const origin = requestUrl.origin;

  // If there's an OAuth error, redirect to error page
  if (error) {
    const errorDescription = requestUrl.searchParams.get("error_description") || error;
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(errorDescription)}`
    );
  }

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing sessions.
            }
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      // Successfully exchanged code - redirect to home
      return NextResponse.redirect(origin);
    }

    // Exchange failed - redirect to error page
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=exchange_failed`
    );
  }

  // No code provided - redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
