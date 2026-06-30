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
        
        // THE FIX: Remove the crashing !pvp_replays_uploaded_by_fkey join
        // Just select the uploaded_by UUID directly.
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
                uploaded_by
            `)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Step 2: Manually fetch the display names from public.users to avoid FK errors
        const uploaderIds = [...new Set((data || []).map(r => r.uploaded_by).filter(Boolean))];
        const usersMap = new Map<string, string>();
        
        if (uploaderIds.length > 0) {
            const { data: usersData } = await supabase
                .from('users')
                .select('id, display_name')
                .in('id', uploaderIds);
                
            if (usersData) {
                usersData.forEach(u => usersMap.set(u.id, u.display_name));
            }
        }

        const mappedData = (data || []).map(row => ({
            id: row.id,
            created_at: row.created_at,
            original_filename: row.original_filename,
            team1_name: row.team1_name,
            team2_name: row.team2_name,
            team1_color: row.team1_color,
            team2_color: row.team2_color,
            uploaded_by_user: row.uploaded_by && usersMap.has(row.uploaded_by) 
                ? { display_name: usersMap.get(row.uploaded_by) } 
                : null
        }));

        return { success: true, replays: mappedData as PvpReplayMeta[] };
    } catch (e) {
        console.error("Failed to load PvP replays:", e);
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
