import { useState, useEffect, useRef, useCallback } from "react";
import type { IncomingMessage, OutgoingMessage, JoinMessage } from "../../shared/types";

interface GameSocketOptions {
  username: string;
  room: string;
  userId: string;
  userImage?: string;
  onMessage?: (message: OutgoingMessage) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: unknown) => void;
}

export function useGameSocket({
  username,
  room,
  userId,
  userImage,
  onMessage,
  onConnect,
  onDisconnect,
  onError,
}: GameSocketOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectKey, setReconnectKey] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOpen = useRef(false);

  const send = useCallback((message: Partial<IncomingMessage>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          ...message,
          timestamp: Date.now(),
        }),
      );
    } else {
      console.warn("Cannot send message: WebSocket is not open", message);
    }
  }, []);

  useEffect(() => {
    // Don't connect until we have valid credentials
    if (!username || !userId || !room) {
      setIsConnected(false);
      return;
    }

    // readyState: CONNECTING=0, OPEN=1, CLOSING=2, CLOSED=3
    if (wsRef.current && wsRef.current.readyState < WebSocket.CLOSING) {
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/${encodeURIComponent(room)}`;

    wasOpen.current = false;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    connectTimer.current = setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.warn("WebSocket connection timed out");
        ws.close();
      }
    }, 10000);

    ws.onopen = () => {
      if (connectTimer.current) {
        clearTimeout(connectTimer.current);
        connectTimer.current = null;
      }
      setIsConnected(true);
      reconnectAttempts.current = 0;
      wasOpen.current = true;
      console.log("[GameSocket] Connected");

      // Send join message immediately on open
      const joinMsg: JoinMessage = {
        type: "join",
        username,
        room,
        userId,
        userImage,
        timestamp: Date.now(),
      };
      ws.send(JSON.stringify(joinMsg));

      onConnect?.();
    };

    ws.onmessage = (event) => {
      try {
        const message: OutgoingMessage = JSON.parse(event.data);
        onMessage?.(message);
      } catch (e) {
        console.error("[GameSocket] Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      onDisconnect?.();
      console.log("[GameSocket] Disconnected");

      if (wasOpen.current) {
        const maxAttempts = 5;
        if (reconnectAttempts.current < maxAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          reconnectAttempts.current += 1;
          console.log(
            `[GameSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current}/${maxAttempts})`,
          );
          reconnectTimer.current = setTimeout(() => {
            setReconnectKey((k) => k + 1);
          }, delay);
        } else {
          console.error("[GameSocket] Max reconnection attempts reached");
        }
      }
    };

    ws.onerror = (error) => {
      console.error("[GameSocket] Error:", error);
      setIsConnected(false);
      onError?.(error);
    };

    return () => {
      wasOpen.current = false;
      if (connectTimer.current) {
        clearTimeout(connectTimer.current);
        connectTimer.current = null;
      }
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      ws.close();
    };
  }, [
    username,
    room,
    userId,
    userImage,
    reconnectKey,
    onMessage,
    onConnect,
    onDisconnect,
    onError,
  ]);

  return {
    isConnected,
    send,
  };
}
