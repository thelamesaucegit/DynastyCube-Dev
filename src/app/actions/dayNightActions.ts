///src/app/actions/dayNightActions.ts

"use server";

import { createServerClient } from "@/lib/supabase";

export async function getUserNightVote(seasonId: string, userId: string) {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from('night_hours_votes')
        .select('selected_hours')
        .eq('season_id', seasonId)
        .eq('user_id', userId)
        .single();
        
    if (error && error.code !== 'PGRST116') return { success: false, error: error.message };
    return { success: true, selectedHours: data?.selected_hours || [] };
}

export async function submitUserNightVote(seasonId: string, teamId: string, userId: string, selectedHours: number[]) {
    if (selectedHours.length > 10) return { success: false, error: "You can only select up to 10 hours." };
    
    const supabase = await createServerClient();
    
    const { error } = await supabase.from('night_hours_votes').upsert({
        season_id: seasonId,
        team_id: teamId,
        user_id: userId,
        selected_hours: selectedHours,
        updated_at: new Date().toISOString()
    }, { onConflict: 'season_id,user_id' });

    if (error) return { success: false, error: error.message };
    
    // Automatically trigger the team aggregation math
    await aggregateTeamNightHours(seasonId, teamId);
    
    return { success: true };
}

export async function getTeamNightSubmission(seasonId: string, teamId: string) {
    const supabase = await createServerClient();
    const { data, error } = await supabase
        .from('team_night_hours_submissions')
        .select('*')
        .eq('season_id', seasonId)
        .eq('team_id', teamId)
        .single();
        
    if (error && error.code !== 'PGRST116') return { success: false, error: error.message };
    return { success: true, submission: data };
}

// ----------------------------------------------------------------------------
// THE ALGORITHM: Find the 10 consecutive hours with the most overlap
// ----------------------------------------------------------------------------
export async function aggregateTeamNightHours(seasonId: string, teamId: string) {
    const supabase = await createServerClient();
    const { data: votes } = await supabase.from('night_hours_votes').select('selected_hours').eq('season_id', seasonId).eq('team_id', teamId);
    
    if (!votes || votes.length === 0) return { success: true, message: "No votes yet." };

    // 1. Tally up the votes for each of the 24 hours
    const hourTallies = new Array(24).fill(0);
    votes.forEach(vote => {
        vote.selected_hours.forEach((h: number) => {
            if (h >= 0 && h <= 23) hourTallies[h]++;
        });
    });

    // 2. Sliding Window (Size 10) to find the max consecutive overlap
    let maxOverlap = -1;
    let bestStartHour = 0;

    for (let start = 0; start < 24; start++) {
        let currentWindowOverlap = 0;
        for (let i = 0; i < 10; i++) {
            const hour = (start + i) % 24; // Handles midnight wrap-around!
            currentWindowOverlap += hourTallies[hour];
        }

        if (currentWindowOverlap > maxOverlap) {
            maxOverlap = currentWindowOverlap;
            bestStartHour = start;
        }
    }

    const endHour = (bestStartHour + 9) % 24;

    // 3. Save the aggregated result
    const { error } = await supabase.from('team_night_hours_submissions').upsert({
        season_id: seasonId,
        team_id: teamId,
        start_hour: bestStartHour,
        end_hour: endHour,
        updated_at: new Date().toISOString()
    }, { onConflict: 'season_id,team_id' });

    if (error) return { success: false, error: error.message };
    return { success: true, start_hour: bestStartHour, end_hour: endHour };
}

export async function calculateSeasonNightWindow(seasonId: string) {
    const supabase = await createServerClient();
    const { data: submissions } = await supabase
        .from('team_night_hours_submissions')
        .select('start_hour, end_hour')
        .eq('season_id', seasonId);
        
    if (!submissions || submissions.length === 0) return { start: 22, end: 6 }; // Default 10pm - 6am if no votes

    // Tally up the 24 hours based on all team submissions
    const hourTallies = new Array(24).fill(0);
    for (const sub of submissions) {
        for (let i = 0; i < 10; i++) {
            const h = (sub.start_hour + i) % 24;
            hourTallies[h]++;
        }
    }

    // Find the 8 consecutive hours with the most overlap
    let maxOverlap = -1;
    let bestStartHour = 22; // default 10pm

    for (let start = 0; start < 24; start++) {
        let currentWindowOverlap = 0;
        for (let i = 0; i < 8; i++) {
            const hour = (start + i) % 24;
            currentWindowOverlap += hourTallies[hour];
        }

        if (currentWindowOverlap > maxOverlap) {
            maxOverlap = currentWindowOverlap;
            bestStartHour = start;
        }
    }

    const endHour = (bestStartHour + 8) % 24;
    return { start: bestStartHour, end: endHour };
}
