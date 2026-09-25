import { NextResponse } from "next/server";
import { advancePlayoffBracket } from "@/app/actions/weeklyMatchupActions";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
    try {
        const supabase = await createServerClient();
        
        // 1. Get the active season
        const { data: season, error } = await supabase
            .from('seasons')
            .select('id, season_name')
            .eq('is_active', true)
            .single();

        if (error || !season) {
            return NextResponse.json({ success: false, error: "No active season found." });
        }

        const isTestSeason = season.season_name.toUpperCase().includes("TEST");

        // 2. Trigger the bracket advancement
        await advancePlayoffBracket(season.id, isTestSeason);

        return NextResponse.json({ 
            success: true, 
            message: `Successfully advanced bracket for ${season.season_name}!` 
        });
    } catch (e) {
        return NextResponse.json({ 
            success: false, 
            error: e instanceof Error ? e.message : String(e) 
        });
    }
}
