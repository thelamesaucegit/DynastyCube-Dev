import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Get the public origin (for redirects). Behind a reverse proxy, request.url
 * can be internal (e.g. http://localhost:3000). Use X-Forwarded-* when present,
 * or NEXT_PUBLIC_APP_URL / VERCEL_URL if set.
 */
function getRedirectOrigin(request: Request): string {
  // Explicit app URL (e.g. https://yourapp.com) overrides everything
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl) {
    return appUrl.replace(/\/$/, "");
  }
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  if (forwardedHost) {
    const proto = forwardedProto ?? (process.env.NODE_ENV === "development" ? "http" : "https");
    return `${proto}://${forwardedHost}`;
  }
  // Vercel sets VERCEL_URL (e.g. yourapp.vercel.app) without protocol
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  const { origin } = new URL(request.url);
  return origin;
}

/**
 * OAuth callback route (PKCE flow).
 * Discord/Google redirect here with ?code=... after login.
 * We create the redirect response first, then use a Supabase client whose
 * cookie adapter writes to that response so Set-Cookie headers are sent.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const origin = getRedirectOrigin(request);
  const code = searchParams.get("code");
  const errorParam = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");
  let next = searchParams.get("next") ?? "/";

  if (!next.startsWith("/")) {
    next = "/";
  }

  if (errorParam) {
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${errorParam}&error_description=${encodeURIComponent(errorDescription || "")}`
    );
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  const redirectTo = new URL(next, origin);
  const response = NextResponse.redirect(redirectTo);

  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: Record<string, unknown>) {
        try {
          response.cookies.set(name, value, options as { path?: string; maxAge?: number; domain?: string; sameSite?: boolean | "lax" | "strict" | "none"; secure?: boolean; httpOnly?: boolean });
        } catch {
          // ignore
        }
      },
      remove(name: string, options: Record<string, unknown>) {
        try {
          response.cookies.set(name, "", { ...options, maxAge: 0 });
        } catch {
          // ignore
        }
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchangeCodeForSession error:", error);
    return NextResponse.redirect(`${origin}/auth/auth-code-error?error=exchange_failed`);
  }

  return response;
}
