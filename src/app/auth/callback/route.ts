import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * OAuth callback route (PKCE flow).
 * Discord/Google redirect here with ?code=... after login.
 * We create the redirect response first, then use a Supabase client whose
 * cookie adapter writes to that response so Set-Cookie headers are sent.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
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
