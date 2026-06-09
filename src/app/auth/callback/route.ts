// src/app/auth/callback/route.ts
// Server-side OAuth callback handler
// Exchanges the auth code for a session and sets cookies properly
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
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
    
    // Check if they arrived via a referral link!
    const referralId = cookieStore.get("dynasty_referral_id")?.value;

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

    if (!exchangeError) {
      
      // THE FIX 3: Inject the Referral ID into their metadata
      if (referralId && sessionData.user) {
        // We use the admin client to bypass RLS and forcefully attach the metadata
        const adminSupabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_KEY!
        );

        // This triggers the PostgreSQL handle_new_user trigger we updated!
        await adminSupabase.auth.admin.updateUserById(sessionData.user.id, {
          user_metadata: { dynasty_referral_id: referralId }
        });

        // Clear the cookie so they don't accidentally refer themselves later
        cookieStore.set("dynasty_referral_id", "", { expires: new Date(0) });
      }

      return NextResponse.redirect(origin);
    }

    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=exchange_failed`
    );
  }

  return NextResponse.redirect(`${origin}/auth/login`);
}
