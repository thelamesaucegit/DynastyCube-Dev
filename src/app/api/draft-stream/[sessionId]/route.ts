// src/app/api/draft-stream/[sessionId]/route.ts
import { createServerClient } from '@/lib/supabase';
// Make sure to import NextRequest
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  // This is the pattern you found: params is a Promise
  { params }: { params: Promise<{ sessionId: string }> }
) {
  // We must now 'await' the params to get the value
  const { sessionId } = await params;

  if (!sessionId) {
    // It's good practice to use NextResponse for consistency
    return new NextResponse('Missing session ID', { status: 400 });
  }

  const supabase = createServerClient();
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
        supabase.removeChannel(channel);
      };
    },
    cancel() {
        console.log(`Readable stream cancelled for session ${sessionId}`);
    }
  });

  // Using a standard Response is perfectly fine for streams
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
