import { useState, useRef, useCallback } from "react";

export type SSEState = "idle" | "connecting" | "streaming" | "complete" | "error";

export interface SSEEvent {
  event: string;
  data: unknown;
}

interface UseSSEOptions {
  onEvent?: (event: SSEEvent) => void;
  onComplete?: (data: unknown) => void;
  onError?: (message: string) => void;
}

interface UseSSEReturn {
  start: (url: string, body: unknown) => void;
  close: () => void;
  state: SSEState;
  lastEvent: SSEEvent | null;
  error: string | null;
}

export function useSSE(options: UseSSEOptions = {}): UseSSEReturn {
  const [state, setState] = useState<SSEState>("idle");
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const start = useCallback(async (url: string, body: unknown) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setState("connecting");
    setError(null);
    setLastEvent(null);

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({ error: "Request failed" }));
        throw new Error(json.error || `HTTP ${response.status}`);
      }

      setState("streaming");

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";
      let currentEvent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            const raw = line.slice(6).trim();
            try {
              const data = JSON.parse(raw);
              const eventObj: SSEEvent = { event: currentEvent, data };

              if (currentEvent === "complete") {
                setLastEvent(eventObj);
                setState("complete");
                optionsRef.current.onComplete?.(data);
              } else if (currentEvent === "error") {
                const msg = (data as { message?: string }).message || "Unknown error";
                setError(msg);
                setState("error");
                optionsRef.current.onError?.(msg);
              } else {
                setLastEvent(eventObj);
                optionsRef.current.onEvent?.(eventObj);
              }
            } catch {
              // skip unparseable data lines
            }
          }
        }
      }

      // Stream ended without complete/error event
      setState((s) => (s === "streaming" ? "complete" : s));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      const msg = err instanceof Error ? err.message : "Connection lost";
      setError(msg);
      setState("error");
      optionsRef.current.onError?.(msg);
    }
  }, []);

  const close = useCallback(() => {
    abortRef.current?.abort();
    setState("idle");
  }, []);

  return { start, close, state, lastEvent, error };
}
