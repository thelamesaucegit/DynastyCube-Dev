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
  
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const isLocal = process.env.NODE_ENV === "development";
  
  let origin = requestUrl.origin;
  if (!isLocal) {
    if (forwardedHost) {
      origin = `https://${forwardedHost}`;
    } else if (hostHeader) {
      origin = `https://${hostHeader}`;
    }
  }

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
            }
          },
        },
      }
    );

    const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (!exchangeError && sessionData.user) {
      
      // THE FIX: Check if this user was created in the last 15 seconds!
      // This is the most reliable way to know it's a first-time sign-up via OAuth
      const createdAt = new Date(sessionData.user.created_at).getTime();
      const now = new Date().getTime();
      const isNewUser = (now - createdAt) < 15000; 

      if (isNewUser) {
          // Send them to the client-side router to process any pending referral!
          return NextResponse.redirect(`${origin}/auth/apply-referral`);
      }

      return NextResponse.redirect(origin);
    }
    
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed`);
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
