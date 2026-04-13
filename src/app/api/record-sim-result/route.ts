//src/app/api/record-sim-result/route.ts

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

        if (!weeklyMatchupId) {
            return NextResponse.json({ error: "weeklyMatchupId is required" }, { status: 400 });
        }

        const result = await recordSimGameResult(weeklyMatchupId, winnerTeamId ?? null);

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 500 });
        }

        return NextResponse.json({ success: true, matchupFinalized: result.matchupFinalized });
    } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
