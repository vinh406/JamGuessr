/**
 * Create an SSE streaming Response.
 *
 * Usage:
 *   return sseStream(async (emit) => {
 *     emit("phase", { phase: "fetching", label: "Fetching tracks..." });
 *     const result = await doWork();
 *     return result; // passed to "complete" event
 *   });
 */

export interface SSEEvent {
  event: string;
  data: unknown;
}

export function sseStream<T>(
  execute: (emit: (event: string, data: unknown) => void) => Promise<T>,
): Response {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(text));
      };
      try {
        const result = await execute(emit);
        emit("complete", result);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        emit("error", { message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
