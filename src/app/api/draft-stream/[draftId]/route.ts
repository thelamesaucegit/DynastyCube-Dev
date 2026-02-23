// src/app/api/draft-stream/[draftId]/route.ts

import { createServerClient } from '@/lib/supabase';

export const dynamic = 'force-dynamic'; // Ensures this route is not statically cached

export async function GET(
  request: Request,
  { params }: { params: { draftId: string } }
) {
  const { draftId } = params;
  
  // Validate draftId if necessary
  if (!draftId) {
    return new Response('Missing draft ID', { status: 400 });
  }

  const supabase = createServerClient();

  const stream = new ReadableStream({
    start(controller) {
      const channelName = `draft-updates-${draftId}`;
      console.log(`Client connected to SSE for draft: ${channelName}`);

      const channel = supabase
        .channel(channelName)
        .on('broadcast', { event: 'new_pick' }, ({ payload }) => {
          console.log(`SSE: Broadcasting new pick for draft ${draftId}`, payload);
          // Format the data as a Server-Sent Event
          controller.enqueue(`data: ${JSON.stringify(payload)}\n\n`);
        })
        .subscribe((status) => {
          // You can optionally log the subscription status
          if (status !== 'SUBSCRIBED') {
            console.warn(`Failed to subscribe to channel: ${channelName}, status: ${status}`);
          }
        });

      // When the client disconnects (e.g., closes the tab), clean up the subscription
      request.signal.onabort = () => {
        console.log(`Client disconnected from SSE for draft ${draftId}. Cleaning up.`);
        supabase.removeChannel(channel);
      };
    },
    cancel() {
        // This is called if the readable stream is cancelled
        console.log(`Readable stream cancelled for draft ${draftId}`);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Important for disabling buffering in some environments
    },
  });
}
