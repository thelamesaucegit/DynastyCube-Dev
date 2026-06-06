// src/app/api/cron/rollover/route.ts
import { NextResponse } from 'next/server';
import { checkAndExecuteSeasonRollover } from '@/app/actions/seasonActions';
import { logSystemEvent } from '@/lib/systemLogger';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        
        // Check for custom token OR standard Vercel Cron Secret
        const providedToken = searchParams.get('token');
        const expectedToken = process.env.SUPABASE_SERVICE_KEY?.substring(0, 10);
        
        const authHeader = request.headers.get('authorization');
        const isVercelCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;

        if (providedToken !== expectedToken && !isVercelCron) {
            // Log unauthorized attempts so you know if your cron service is configured incorrectly!
            await logSystemEvent("CronSecurity", "warn", `Unauthorized hit on rollover cron route. Token provided: ${providedToken ? 'Yes' : 'No'}`);
            return new NextResponse('Unauthorized', { status: 401 });
        }

        // Delegate entirely to our robust action function!
        const result = await checkAndExecuteSeasonRollover();

        if (!result.success) {
            return NextResponse.json({ error: result.error || result.message }, { status: 500 });
        }

        return NextResponse.json({ status: result.message });

    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[CRON] Fatal Rollover route failure:", msg);
        
        // Attempt a last-resort DB log
        await logSystemEvent("CronFatal", "error", `Rollover route crashed: ${msg}`);
        
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
