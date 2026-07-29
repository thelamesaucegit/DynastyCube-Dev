// src/app/api/webhooks/kofi/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  try {
    // Ko-fi sends form data with a 'data' field containing the JSON payload
    const formData = await request.formData();
    const dataString = formData.get('data') as string;
    
    if (!dataString) {
      return NextResponse.json({ error: 'No data payload found' }, { status: 400 });
    }

    const payload = JSON.parse(dataString);
    
    // Validate verification token (You set this in your Ko-fi Advanced settings)
    const KOFI_TOKEN = process.env.KOFI_WEBHOOK_TOKEN;
    if (KOFI_TOKEN && payload.verification_token !== KOFI_TOKEN) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY! // Need service key to bypass RLS and query users table
    );

    let linkedUserId = null;
    let linkedTeamId = null;

    // Try to link the donation to a user by email
    if (payload.email) {
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('email', payload.email)
        .maybeSingle();
        
      if (user) {
        linkedUserId = user.id;
        // Check if they are on a team
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .maybeSingle();
        if (teamMember) linkedTeamId = teamMember.team_id;
      }
    }

    // Insert into donations table (The trigger we created earlier will handle the math)
    await supabase.from('donations').insert({
      source: 'kofi',
      donor_email: payload.email,
      donor_name: payload.from_name,
      amount: parseFloat(payload.amount),
      currency: payload.currency,
      message: payload.message,
      linked_user_id: linkedUserId,
      linked_team_id: linkedTeamId,
      payload: payload
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Ko-fi Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
