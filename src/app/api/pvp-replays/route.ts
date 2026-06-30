// src/app/api/pvp-replays/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Helper for Admin Client to bypass any RLS on inserts
function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Fallback for GET requests
export async function GET() {
    return NextResponse.json({ error: "Method Not Allowed. Use POST to upload replays." }, { status: 405 });
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const body = await request.json();
        
        const { 
            argentum_game_states,
            original_filename,
            match_id,
            team1_id,
            team2_id,
            winner_team_id,
            team1_name, team1_color, team1_seccolor,
            team2_name, team2_color, team2_seccolor,
            uploader_id
        } = body;

        if (!argentum_game_states || !original_filename) {
            return NextResponse.json({ error: "Missing game states or filename." }, { status: 400 });
        }

        console.log(`[PvP Replay API] 📥 Receiving replay: ${original_filename}`);

        const supabase = getSupabaseAdmin();

        // 1. Prepare the payload strictly typed
        const payload: Record<string, unknown> = {
            argentum_game_states,
            original_filename,
            uploaded_by: uploader_id || null,
            match_id: match_id || null,
            team1_id: team1_id || null,
            team2_id: team2_id || null,
            winner_team_id: winner_team_id || null,
            team1_name: team1_name || null,
            team1_color: team1_color || null,
            team1_seccolor: team1_seccolor || null,
            team2_name: team2_name || null,
            team2_color: team2_color || null,
            team2_seccolor: team2_seccolor || null,
        };

        // 2. Insert into pvp_replays
        // Casting as unknown as never to bypass strict schema inference limits for JSONB arrays
        const { data: replayData, error: insertError } = await supabase
            .from('pvp_replays')
            .insert(payload as unknown as never)
            .select('id')
            .single();

        if (insertError || !replayData) {
            console.error("[PvP Replay API] ❌ Insert Error:", insertError);
            throw new Error(insertError?.message || "Failed to insert replay.");
        }

        const typedData = replayData as unknown as { id: string };
        console.log(`[PvP Replay API] ✅ Successfully saved PvP Replay ID: ${typedData.id}`);

        return NextResponse.json({ success: true, replayId: typedData.id });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error(`\n[PvP Replay API] ❌ FATAL ERROR:`, msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
