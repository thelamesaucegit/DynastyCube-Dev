// src/app/actions/tesseractAuthActions.ts

"use server";

import { createServerClient, createAdminClient } from "@/lib/supabase"; 
import { cookies } from "next/headers";
import crypto from "crypto";

export interface TesseractParticipant {
    id: string;
    draft_session_id: string;
    user_id: string | null;
    display_name: string;
    draft_position: number;
}

export async function joinTesseractLobby(
    sessionId: string, 
    displayName: string, 
    passcode?: string
): Promise<{ success: boolean; participant?: TesseractParticipant; error?: string }> {
    const authClient = await createServerClient();
    const adminSupabase = createAdminClient(); 
    
    try {
        const trimmedName = displayName.trim();
        if (!trimmedName || trimmedName.length < 2) {
            return { success: false, error: "Display name must be at least 2 characters." };
        }

        const { data: session, error: sessionErr } = await adminSupabase
            .from('tesseract_draft_sessions')
            .select('id, passcode, status, max_players') // <-- ADDED max_players
            .eq('id', sessionId)
            .single();

        if (sessionErr || !session) return { success: false, error: "Draft session not found." };
        if (session.status !== 'scheduled') return { success: false, error: "This draft has already started or finished." };
        if (session.passcode && session.passcode !== passcode) {
            return { success: false, error: "Incorrect lobby passcode." };
        }

        const { data: { user } } = await authClient.auth.getUser();
        const sessionToken = crypto.randomBytes(32).toString('hex');

        const { count, error: countErr } = await adminSupabase
            .from('tesseract_participants')
            .select('*', { count: 'exact', head: true })
            .eq('draft_session_id', sessionId);

        if (countErr) return { success: false, error: "Database error checking lobby size." };
        
        // THE FIX: Enforce Lobby Limit!
        if (session.max_players && count !== null && count >= session.max_players) {
             return { success: false, error: "This draft lobby is already full." };
        }
        
        const nextPosition = (count || 0) + 1;

        const { data: participant, error: insertErr } = await adminSupabase
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
            if (insertErr.code === '23505') { 
                return { success: false, error: "That display name is already taken in this lobby." };
            }
            throw insertErr;
        }

        const cookieStore = await cookies();
        cookieStore.set(`tesseract_token_${sessionId}`, sessionToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 14, 
            path: '/'
        });

        return { success: true, participant: participant as TesseractParticipant };
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.error("Error joining Tesseract lobby:", message);
        return { success: false, error: "An unexpected error occurred." };
    }
}

export async function getTesseractSessionUser(sessionId: string): Promise<{
    participant: TesseractParticipant | null;
    error?: string;
}> {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get(`tesseract_token_${sessionId}`)?.value;

        if (!token) return { participant: null };

        const adminSupabase = createAdminClient();
        const { data, error } = await adminSupabase
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
