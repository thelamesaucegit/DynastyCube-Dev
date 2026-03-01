// src/app/api/match-runner/route.ts
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const body = await request.json();
  
  try {
    const simServerUrl = process.env.SIMULATION_SERVER_URL;
    if (!simServerUrl) throw new Error("Simulation server URL is not configured.");

    // This just forwards the request. No need for a Supabase client here.
    const response = await fetch(`${simServerUrl}/start-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        throw new Error(`Simulation server returned an error: ${response.statusText}`);
    }
    
    const data = await response.json();

    return NextResponse.json(data);

  } catch (error: unknown) { // FIX: Use 'unknown' instead of 'any'
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
