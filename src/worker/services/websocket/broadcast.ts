import type { OutgoingMessage, BroadcastMessage, UserSession } from "../../../shared/types";

/**
 * Broadcasts a message to all WebSocket connections in a specific room
 */
export function broadcastToRoom(
  sessions: Map<WebSocket, UserSession>,
  room: string,
  message: OutgoingMessage,
): void {
  const roomUsers = Array.from(sessions.entries()).filter(([, session]) => session.room === room);

  const broadcastMessage: BroadcastMessage = {
    ...message,
    connections: roomUsers.length,
    totalConnections: sessions.size,
  };

  const messageString = JSON.stringify(broadcastMessage);

  roomUsers.forEach(([socket]) => {
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
