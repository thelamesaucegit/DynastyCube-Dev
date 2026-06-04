//src/app/api/cron/rollover/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSeasonRollover } from '@/app/actions/seasonActions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);

    if (searchParams.get('token') !== process.env.SUPABASE_SERVICE_KEY?.substring(0, 10)) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );

        // FIX 4: Ensure the cron job uses the same fuzzy match
        const { data: timer } = await supabase
            .from('countdown_timers')
            .select('*')
            .eq('is_active', true)
            .ilike('title', '%Offseason Curation%')
            .single();

        if (!timer) {
            return NextResponse.json({ status: 'No active offseason timer found' });
        }

        if (new Date() < new Date(timer.end_time)) {
            return NextResponse.json({ status: 'Offseason timer is still ticking' });
        }

        console.log("[CRON] Offseason timer expired! Initiating Rollover...");
        const result = await executeSeasonRollover();

        if (!result.success) {
            throw new Error(result.error);
        }

        return NextResponse.json({ status: 'Rollover executed successfully!' });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[CRON] Rollover failed:", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
