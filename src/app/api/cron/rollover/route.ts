//src/app/api/cron/rollover/route.ts

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { executeSeasonRollover } from '@/app/actions/seasonActions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // Basic security: require a simple token in the URL (e.g. /api/cron/rollover?token=my-secret-token)
    const { searchParams } = new URL(request.url);
    if (searchParams.get('token') !== process.env.SUPABASE_SERVICE_KEY?.substring(0, 10)) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        // God-mode client for checking the timer
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_KEY!
        );

        // 1. Check if there is an active Offseason Timer that has EXPIRED
        const { data: timer } = await supabase
            .from('countdown_timers')
            .select('*')
            .eq('is_active', true)
            .ilike('title', '%Offseason%')
            .single();

        if (!timer) {
            return NextResponse.json({ status: 'No active offseason timer found' });
        }

        if (new Date() < new Date(timer.end_time)) {
            return NextResponse.json({ status: 'Offseason timer is still ticking' });
        }

        // 2. The timer has expired! Execute the massive rollover!
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
