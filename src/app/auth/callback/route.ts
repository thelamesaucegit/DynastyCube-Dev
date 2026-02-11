// src/app/auth/callback/route.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  // Handle OAuth errors from the provider
  if (error) {
    const errorDesc = searchParams.get("error_description") || error;
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error)}&error_description=${encodeURIComponent(errorDesc)}`
    );
  }

  if (code) {
    // Create the redirect response upfront so cookies get set directly on it
    const response = NextResponse.redirect(`${origin}/`);

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      }
    );

    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError) {
      return response;
    }

    console.error("Auth code exchange failed:", exchangeError.message);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=exchange_failed&error_description=${encodeURIComponent(exchangeError.message)}`
    );
  }

  // No code and no error - redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
