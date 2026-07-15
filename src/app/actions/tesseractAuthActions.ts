// src/app/actions/tesseractAuthActions.ts

"use server";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import crypto from "crypto";

export interface TesseractParticipant {
    id: string;
    draft_session_id: string;
    user_id: string | null;
    display_name: string;
    draft_position: number;
}

async function createClient() {
    const cookieStore = await cookies();
    return createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return cookieStore.getAll(); },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
                    } catch {
                        // Ignore errors in Server Components
                    }
                },
            },
        }
    );
}

/**
 * Validates the lobby passcode and joins the participant to the Tesseract draft.
 * Drops an HTTP-only cookie to maintain the session.
 */
export async function joinTesseractLobby(
    sessionId: string, 
    displayName: string, 
    passcode?: string
): Promise<{ success: boolean; participant?: TesseractParticipant; error?: string }> {
    const supabase = await createClient();
    
    try {
        const trimmedName = displayName.trim();
        if (!trimmedName || trimmedName.length < 2) {
            return { success: false, error: "Display name must be at least 2 characters." };
        }

        // 1. Fetch Session & Validate Passcode
        const { data: session, error: sessionErr } = await supabase
            .from('tesseract_draft_sessions')
            .select('id, passcode, status')
            .eq('id', sessionId)
            .single();

        if (sessionErr || !session) return { success: false, error: "Draft session not found." };
        if (session.status !== 'scheduled') return { success: false, error: "This draft has already started or finished." };
        if (session.passcode && session.passcode !== passcode) {
            return { success: false, error: "Incorrect lobby passcode." };
        }

        // 2. Check if user is logged into the main site
        const { data: { user } } = await supabase.auth.getUser();

        // 3. Generate a secure guest token
        const sessionToken = crypto.randomBytes(32).toString('hex');

        // 4. Determine next draft position (count current participants + 1)
        const { count, error: countErr } = await supabase
            .from('tesseract_participants')
            .select('*', { count: 'exact', head: true })
            .eq('draft_session_id', sessionId);

        if (countErr) return { success: false, error: "Database error checking lobby size." };
        const nextPosition = (count || 0) + 1;

        // 5. Insert Participant
        const { data: participant, error: insertErr } = await supabase
            .from('tesseract_participants')
            .insert({
                draft_session_id: sessionId,
                user_id: user?.id || null,
                display_name: trimmedName,
                session_token: sessionToken,
                draft_position: nextPosition
            })
            .select()
            .single();

        if (insertErr) {
            if (insertErr.code === '23505') { // Unique constraint violation
                return { success: false, error: "That display name is already taken in this lobby." };
            }
            throw insertErr;
        }

        // 6. Set the secure cookie
        const cookieStore = await cookies();
        cookieStore.set(`tesseract_token_${sessionId}`, sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 14, // 14 days
            path: '/'
        });

        return { success: true, participant: participant as TesseractParticipant };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error joining Tesseract lobby:", message);
        return { success: false, error: "An unexpected error occurred." };
    }
}

/**
 * Retrieves the current participant for the given session based on their cookie.
 */
export async function getTesseractSessionUser(sessionId: string): Promise<{
    participant: TesseractParticipant | null;
    error?: string;
}> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(`tesseract_token_${sessionId}`)?.value;

        if (!token) return { participant: null };

        const supabase = await createClient();
        const { data, error } = await supabase
            .from('tesseract_participants')
            .select('id, draft_session_id, user_id, display_name, draft_position')
            .eq('session_token', token)
            .eq('draft_session_id', sessionId)
            .single();

        if (error || !data) return { participant: null };

        return { participant: data as TesseractParticipant };
    } catch (error: unknown) {
        return { participant: null, error: String(error) };
    }
}
