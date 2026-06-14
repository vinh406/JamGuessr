import type { OutgoingMessage, BroadcastMessage, UserSession } from "../../shared/types";

/**
 * Broadcasts a message to all WebSocket connections in the room.
 * All sessions in this DO belong to the same room (DO is per-room).
 */
export function broadcastToRoom(
  sessions: Map<WebSocket, UserSession>,
  message: OutgoingMessage,
): void {
  const broadcastMessage: BroadcastMessage = {
    ...message,
    connections: sessions.size,
  };

  const messageString = JSON.stringify(broadcastMessage);

  sessions.forEach((_session, socket) => {
    try {
      socket.send(messageString);
    } catch (error) {
      console.error("Failed to send message to socket:", error);
      sessions.delete(socket);
    }
  });
}

/**
 * Sends a message to a specific WebSocket connection
 * Returns true if successful, false otherwise
 */
export function sendToSocket(ws: WebSocket, message: OutgoingMessage): boolean {
  try {
    ws.send(JSON.stringify(message));
    return true;
  } catch (error) {
    console.error("Failed to send message to socket:", error);
    return false;
  }
}
