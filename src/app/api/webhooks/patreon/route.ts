// src/app/api/webhooks/patreon/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: Request) {
  const eventType = request.headers.get('x-patreon-event');
  console.log(`\n--- [Patreon Webhook] Incoming Request | Event: ${eventType} ---`);
  
  try {
    const signature = request.headers.get('x-patreon-signature');
    const rawBody = await request.text();

    const PATREON_SECRET = process.env.PATREON_WEBHOOK_SECRET;
    if (PATREON_SECRET && signature) {
      const hash = crypto.createHmac('md5', PATREON_SECRET).update(rawBody).digest('hex');
      if (signature !== hash) {
        console.warn('[Patreon Webhook] Invalid HMAC signature!');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
      console.log('[Patreon Webhook] Signature verified.');
    }

    const payload = JSON.parse(rawBody);
    
    if (eventType !== 'members:pledge:create' && eventType !== 'members:pledge:update') {
      console.log(`[Patreon Webhook] Ignored event type: ${eventType}`);
      return NextResponse.json({ success: true, message: 'Event ignored' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // --- CORRECTED DATA EXTRACTION ---
    const pledgeData = payload.data;
    const patronId = pledgeData.relationships.patron.data.id;
    const patronObject = payload.included.find((item: { type: string, id: string }) => item.type === 'user' && item.id === patronId);

    const email = patronObject?.attributes?.email;
    const fullName = patronObject?.attributes?.full_name;
    const amountCents = pledgeData.attributes.amount_cents || 0; // <-- THE FIX
    const amount = amountCents / 100;
    // --- END CORRECTION ---

    console.log(`[Patreon Webhook] Parsed Pledge - Name: ${fullName}, Email: ${email}, Amount: $${amount}`);

    if (amount <= 0) {
      console.log('[Patreon Webhook] Zero amount pledge ignored.');
      return NextResponse.json({ success: true, message: 'Zero amount pledge' });
    }

    let linkedUserId = null;
    let linkedTeamId = null;

    if (email) {
      console.log(`[Patreon Webhook] Searching for user with email: ${email}...`);
      const { data: user } = await supabase.from('users').select('id').ilike('email', email).maybeSingle();
      
      if (user) {
        linkedUserId = user.id;
        console.log(`[Patreon Webhook] Match found! User ID: ${user.id}`);
        
        const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).maybeSingle();
        if (teamMember) {
            linkedTeamId = teamMember.team_id;
            console.log(`[Patreon Webhook] User is linked to Team ID: ${teamMember.team_id}`);
        }
      } else {
        console.log(`[Patreon Webhook] No matching user found for email. Logging as anonymous.`);
      }
    }

    console.log(`[Patreon Webhook] Checking idempotency for Patreon Pledge ID: ${pledgeData.id}...`);
    const { data: existing } = await supabase
      .from('donations')
      .select('id')
      .eq('source', 'patreon')
      .eq('payload->data->>id', pledgeData.id)
      .maybeSingle();

    if (!existing) {
      console.log('[Patreon Webhook] Inserting new donation record...');
      const { error: insertError } = await supabase.from('donations').insert({
        source: 'patreon',
        donor_email: email,
        donor_name: fullName,
        amount: amount,
        currency: 'USD',
        linked_user_id: linkedUserId,
        linked_team_id: linkedTeamId,
        payload: payload
      });

      if (insertError) {
        console.error('[Patreon Webhook] DB Insert Error:', insertError);
        throw insertError;
      }
      console.log('--- [Patreon Webhook] Successfully processed donation! ---\n');
    } else {
      console.log('--- [Patreon Webhook] Donation already exists. Ignored duplicate webhook. ---\n');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('--- [Patreon Webhook] Fatal Error ---', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
