import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

/**
 * OAuth callback route (PKCE flow).
 * Discord/Google redirect here with ?code=... after login.
 * We must exchange the code for a session and set cookies before redirecting.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

  // User denied or OAuth error
  if (errorParam) {
    const errorDescription = searchParams.get("error_description") ?? "";
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${errorParam}&error_description=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchangeCodeForSession error:", error);
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed`);
  }

  const forwardedHost = request.headers.get("x-forwarded-host");
  const isLocalEnv = process.env.NODE_ENV === "development";

  if (isLocalEnv) {
    return NextResponse.redirect(`${origin}${next}`);
  }
  if (forwardedHost) {
    return NextResponse.redirect(`https://${forwardedHost}${next}`);
  }
  return NextResponse.redirect(`${origin}${next}`);
}
