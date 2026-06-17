// src/app/actions/pvpReplayActions.ts
"use server";

import { createServerClient } from "@/lib/supabase";

export interface PvpReplayMeta {
    id: string;
    created_at: string;
    original_filename: string;
    team1_name: string | null;
    team2_name: string | null;
    team1_color: string | null;
    team2_color: string | null;
    uploaded_by_user?: { display_name?: string } | null;
}

export async function getPvpReplays(): Promise<{ success: boolean; replays: PvpReplayMeta[]; error?: string }> {
    try {
        const supabase = await createServerClient();
        
        // Use an outer join or direct fetch to get the user who uploaded it
        const { data, error } = await supabase
            .from('pvp_replays')
            .select(`
                id, 
                created_at, 
                original_filename, 
                team1_name, 
                team2_name,
                team1_color,
                team2_color,
                uploaded_by:users!pvp_replays_uploaded_by_fkey(display_name)
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Map the relation explicitly to avoid TS complaining about joined array types
        const mappedData = (data || []).map(row => ({
            id: row.id,
            created_at: row.created_at,
            original_filename: row.original_filename,
            team1_name: row.team1_name,
            team2_name: row.team2_name,
            team1_color: row.team1_color,
            team2_color: row.team2_color,
            uploaded_by_user: Array.isArray(row.uploaded_by) ? row.uploaded_by[0] : row.uploaded_by
        }));

        return { success: true, replays: mappedData as PvpReplayMeta[] };
    } catch (e) {
        return { success: false, replays: [], error: String(e) };
    }
}

export async function deletePvpReplay(id: string): Promise<{ success: boolean; error?: string }> {
    try {
        const supabase = await createServerClient();
        
        // Ensure only admins can delete
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { success: false, error: "Not authenticated" };
        
        const { data: userData } = await supabase.from('users').select('is_admin').eq('id', user.id).single();
        if (!userData?.is_admin) return { success: false, error: "Not authorized" };

        const { error } = await supabase.from('pvp_replays').delete().eq('id', id);
        if (error) throw error;

        return { success: true };
    } catch (e) {
        return { success: false, error: String(e) };
    }
}
