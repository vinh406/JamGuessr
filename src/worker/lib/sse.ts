/**
 * Create an SSE streaming Response.
 *
 * The `execute` function receives an `emit` callback and an `AbortSignal`.
 * When the client disconnects, the signal is aborted — the `execute` function
 * should check `signal.aborted` and stop work accordingly.
 *
 * Usage:
 *   return sseStream(async (emit, signal) => {
 *     emit("phase", { phase: "fetching", label: "Fetching tracks..." });
 *     const result = await doWork({ signal });
 *     return result; // passed to "complete" event
 *   });
 */

export function sseStream<T>(
  execute: (emit: (event: string, data: unknown) => void, signal: AbortSignal) => Promise<T>,
): Response {
  const abortController = new AbortController();

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (event: string, data: unknown) => {
        const text = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(text));
      };
      try {
        const result = await execute(emit, abortController.signal);
        if (!abortController.signal.aborted) {
          emit("complete", result);
        }
      } catch (err) {
        if (abortController.signal.aborted) return;
        const message = err instanceof Error ? err.message : "Unknown error";
        emit("error", { message });
      } finally {
        try {
          controller.close();
        } catch {
          /* ignore if already closed */
        }
      }
    },
    cancel() {
      abortController.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
    },
  });
}
