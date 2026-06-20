// src/app/api/cron/finalize-polls/route.ts

import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { executeTeamTransformation } from "@/app/actions/teamActions";

// This is a simplified, dedicated client for cron jobs
const getSupabaseAdmin = () => createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
);

export async function GET(request: Request) {
    // Secure the endpoint with a secret cron key
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return new Response('Unauthorized', { status: 401 });
    }

    const supabase = getSupabaseAdmin();
    console.log("[Cron: FinalizePolls] Starting job...");

    try {
        const { data: expiredPolls, error: fetchError } = await supabase
            .from('polls')
            .select('id, trigger_event, vote_type, team_id')
            .eq('is_active', true)
            .lte('ends_at', new Date().toISOString());

        if (fetchError) throw fetchError;

        if (!expiredPolls || expiredPolls.length === 0) {
            console.log("[Cron: FinalizePolls] No expired polls found.");
            return NextResponse.json({ success: true, finalized: 0 });
        }

        console.log(`[Cron: FinalizePolls] Found ${expiredPolls.length} expired poll(s) to process.`);
        let finalizedCount = 0;

        for (const poll of expiredPolls) {
            // Mark the poll as inactive first
            await supabase.from('polls').update({ is_active: false }).eq('id', poll.id);

            // --- Execute the Trigger Event ---
            if (poll.trigger_event === 'lorwyn_shadowmoor_swap') {
                console.log(`[Cron: FinalizePolls] Processing event: ${poll.trigger_event} for poll ${poll.id}`);
                
                const { data: results } = await supabase
                    .from('poll_options')
                    .select('id, option_text')
                    .eq('poll_id', poll.id)
                    .order('vote_count', { ascending: false })
                    .limit(1)
                    .single();
                
                if (results?.option_text === 'Transform into Mimics') {
                    console.log(`[Cron: FinalizePolls] Vote passed! Transforming team ${poll.team_id}.`);
                    await executeTeamTransformation(poll.team_id, 'mimics');
                }
            }
            // Add other trigger events here in the future with `else if (...)`
            
            finalizedCount++;
        }

        return NextResponse.json({ success: true, finalized: finalizedCount });

    } catch (error) {
        console.error("[Cron: FinalizePolls] CRITICAL ERROR:", error);
        return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
    }
}
