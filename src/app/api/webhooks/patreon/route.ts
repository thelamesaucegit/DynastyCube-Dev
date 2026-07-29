// src/app/api/webhooks/patreon/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const signature = request.headers.get('x-patreon-signature');
    const rawBody = await request.text();

    // Verify webhook signature (Get the secret from Patreon Developer Portal)
    const PATREON_SECRET = process.env.PATREON_WEBHOOK_SECRET;
    if (PATREON_SECRET && signature) {
      const hash = crypto.createHmac('md5', PATREON_SECRET).update(rawBody).digest('hex');
      if (signature !== hash) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);
    
    // We only care about pledge creation or updates
    const eventType = request.headers.get('x-patreon-event');
    if (eventType !== 'members:pledge:create' && eventType !== 'members:pledge:update') {
      return NextResponse.json({ success: true, message: 'Event ignored' });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // Patreon payloads are complex (JSON:API format). Extract email and amount.
    const memberData = payload.data;
    const email = memberData?.attributes?.email;
    const amountCents = memberData?.attributes?.pledge_amount_cents || 0;
    const amount = amountCents / 100;

    if (amount <= 0) {
      return NextResponse.json({ success: true, message: 'Zero amount pledge' });
    }

    let linkedUserId = null;
    let linkedTeamId = null;

    if (email) {
      const { data: user } = await supabase.from('users').select('id').ilike('email', email).maybeSingle();
      if (user) {
        linkedUserId = user.id;
        const { data: teamMember } = await supabase.from('team_members').select('team_id').eq('user_id', user.id).maybeSingle();
        if (teamMember) linkedTeamId = teamMember.team_id;
      }
    }

    // Check if we already logged this specific pledge update (Idempotency check)
    // Patreon can send duplicate webhooks.
    const { data: existing } = await supabase
      .from('donations')
      .select('id')
      .eq('source', 'patreon')
      .eq('payload->data->>id', memberData.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('donations').insert({
        source: 'patreon',
        donor_email: email,
        donor_name: memberData?.attributes?.full_name,
        amount: amount,
        currency: 'USD',
        linked_user_id: linkedUserId,
        linked_team_id: linkedTeamId,
        payload: payload
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Patreon Webhook Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
