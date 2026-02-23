// src/app/api/draft-stream/[sessionId]/route.ts
import { createServerClient } from '@/lib/supabase';
// No need for NextRequest here, the standard Request type is correct
// when using the signature below.

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  // This is the key: Destructure `params` directly from the second argument.
  // The type annotation { params: { sessionId: string } } then describes the object being destructured.
  { params }: { params: { sessionId: string } }
) {
  const { sessionId } = params;

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
