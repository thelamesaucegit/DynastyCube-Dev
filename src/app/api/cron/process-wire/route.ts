// src/app/api/cron/process-wire/route.ts

import { NextResponse } from "next/server";
import { processWireBids } from "@/app/actions/wireActions";

export async function POST(request: Request) {
    // Basic security: Ensure the request comes from our secure edge function
    const authHeader = request.headers.get('authorization');
    
    // We will pass the SUPABASE_SERVICE_ROLE_KEY from the edge function as the bearer token
    if (authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_KEY}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const result = await processWireBids();
        
        if (!result.success) {
            return NextResponse.json(result, { status: 500 });
        }
        
        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
