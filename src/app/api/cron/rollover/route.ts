// src/app/api/cron/rollover/route.ts
import { NextResponse } from 'next/server';
import { checkAndExecuteSeasonRollover } from '@/app/actions/seasonActions';
import { logSystemEvent } from '@/lib/systemLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // We removed the token check. The database timestamp acts as the true security lock!
        const result = await checkAndExecuteSeasonRollover();

        if (!result.success) {
            return NextResponse.json({ error: result.error || result.message }, { status: 500 });
        }

        return NextResponse.json({ status: result.message });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[CRON] Fatal Rollover route failure:", msg);
        
        await logSystemEvent("CronFatal", "error", `Rollover route crashed: ${msg}`);
        
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
