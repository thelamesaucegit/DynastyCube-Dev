// src/app/api/draft-stream/[sessionId]/route.ts

import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

// The function signature for GET is updated here
export async function GET(
  request: Request,
  // The second argument should be a single object, often called `context`
  context: { params: { sessionId: string } } 
) {
  // We now get 'sessionId' from context.params
  const { sessionId } = context.params;
  
  if (!sessionId) {
    return new Response('Missing session ID', { status: 400 });
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

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
