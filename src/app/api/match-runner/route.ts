// src/app/api/match-runner/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

// This is the server-side Supabase client
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);

export async function POST(request: Request) {
  const body = await request.json();
  
  // This route now forwards the request to your sidecar simulation server.
  try {
    const simServerUrl = process.env.SIMULATION_SERVER_URL; // e.g., 'http://forgesim-service.onrender.com'
    if (!simServerUrl) throw new Error("Simulation server URL is not configured.");

    const response = await fetch(`${simServerUrl}/start-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Simulation server returned an error: ${response.statusText}`);
    }
    
    // The server should respond with the match ID it created.
    const data = await response.json();

    return NextResponse.json(data);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
