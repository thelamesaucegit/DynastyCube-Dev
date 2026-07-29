// src/app/api/webhooks/kofi/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: Request) {
  console.log('\n--- [Ko-fi Webhook] Incoming Request ---');
  try {
    const formData = await request.formData();
    const dataString = formData.get('data') as string;
    
    if (!dataString) {
      console.warn('[Ko-fi Webhook] No data payload found in formData.');
      return NextResponse.json({ error: 'No data payload found' }, { status: 400 });
    }

    const payload = JSON.parse(dataString);
    console.log(`[Ko-fi Webhook] Payload parsed. From: ${payload.from_name}, Amount: ${payload.amount} ${payload.currency}, Email: ${payload.email}`);
    
    const KOFI_TOKEN = process.env.KOFI_WEBHOOK_TOKEN;
    if (KOFI_TOKEN && payload.verification_token !== KOFI_TOKEN) {
      console.warn('[Ko-fi Webhook] Invalid verification token received.');
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY! 
    );

    let linkedUserId = null;
    let linkedTeamId = null;

    if (payload.email) {
      console.log(`[Ko-fi Webhook] Searching for user with email: ${payload.email}...`);
      const { data: user } = await supabase
        .from('users')
        .select('id')
        .ilike('email', payload.email)
        .maybeSingle();
        
      if (user) {
        linkedUserId = user.id;
        console.log(`[Ko-fi Webhook] Match found! User ID: ${user.id}`);
        
        const { data: teamMember } = await supabase
          .from('team_members')
          .select('team_id')
          .eq('user_id', user.id)
          .maybeSingle();
          
        if (teamMember) {
            linkedTeamId = teamMember.team_id;
            console.log(`[Ko-fi Webhook] User is linked to Team ID: ${teamMember.team_id}`);
        }
      } else {
        console.log(`[Ko-fi Webhook] No matching user found for email: ${payload.email}. Logging as anonymous.`);
      }
    }

    console.log('[Ko-fi Webhook] Inserting donation into database...');
    const { error: insertError } = await supabase.from('donations').insert({
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

    if (insertError) {
      console.error('[Ko-fi Webhook] DB Insert Error:', insertError);
      throw insertError;
    }

    console.log('--- [Ko-fi Webhook] Successfully processed donation! ---\n');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('--- [Ko-fi Webhook] Fatal Error ---', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
