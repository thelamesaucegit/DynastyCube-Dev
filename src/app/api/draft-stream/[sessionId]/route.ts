// src/app/api/draft-stream/[sessionId]/route.ts

import { createServerClient } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  if (!sessionId) {
    return new NextResponse('Missing session ID', { status: 400 });
  }

  // --- THIS IS THE FIX ---
  // Await the function call to get the actual client object
  const supabase = await createServerClient();

  const stream = new ReadableStream({
    start(controller) {
      const channelName = `draft-updates-${sessionId}`;
      console.log(`Client connected to SSE for draft session: ${channelName}`);
      
      const channel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'new_pick' }, ({ payload }) => {
          console.log(`SSE: Broadcasting new pick for session ${sessionId}`, payload);
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        })
        .subscribe((status) => {
          if (status !== 'SUBSCRIBED') {
            console.warn(`Failed to subscribe to channel: ${channelName}, status: ${status}`);
          }
        });

      request.signal.onabort = () => {
        console.log(`Client disconnected from SSE for session ${sessionId}. Cleaning up.`);
        // Note: No 'await' is needed here because the `supabase` variable in this scope
        // is the already-resolved client object.
        supabase.removeChannel(channel);
      };
    },
    cancel() {
        console.log(`Readable stream cancelled for session ${sessionId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
