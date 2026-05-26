
// src/app/api/record-sim-result/route.ts

import { NextResponse } from "next/server";
import { recordSimGameResult } from "@/app/actions/weeklyMatchupActions";

interface RecordSimResultBody {
    weeklyMatchupId: string;
    winnerTeamId: string | null;
}

export async function POST(request: Request): Promise<NextResponse> {
    try {
        const body = await request.json() as RecordSimResultBody;
        const { weeklyMatchupId, winnerTeamId } = body;

        console.log(`\n[API/record-sim-result] 📥 Webhook received!`);
        console.log(`[API/record-sim-result] Matchup ID: ${weeklyMatchupId}`);
        console.log(`[API/record-sim-result] Winner ID: ${winnerTeamId ?? 'DRAW'}`);

        if (!weeklyMatchupId) {
            console.error(`[API/record-sim-result] ❌ Rejected: Missing weeklyMatchupId`);
            return NextResponse.json({ error: "weeklyMatchupId is required" }, { status: 400 });
        }

        const result = await recordSimGameResult(weeklyMatchupId, winnerTeamId ?? null);

        if (!result.success) {
            console.error(`[API/record-sim-result] ❌ Action Failed: ${result.error}`);
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        console.log(`[API/record-sim-result] ✅ Success! Matchup Finalized: ${result.matchupFinalized}\n`);
        return NextResponse.json({ success: true, matchupFinalized: result.matchupFinalized });

    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`\n[API/record-sim-result] ❌ FATAL CRASH: ${msg}\n`);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
