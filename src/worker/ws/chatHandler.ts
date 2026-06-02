import { RoomManager } from ".";
import { MessageBuilders, broadcastToRoom, sendToSocket } from ".";
import type { ChatMessage } from "../../shared/types";
import { MAX_CHAT_MESSAGE_LENGTH } from "../../shared/constants";
import { getSessionOrError } from "./utils";

export class ChatHandler {
  constructor(private roomManager: RoomManager) {}

  async handleChatMessage(ws: WebSocket, data: ChatMessage): Promise<void> {
    const session = getSessionOrError(this.roomManager, ws);
    if (!session) return;

    const trimmedContent = data.content?.trim() || "";
    if (!trimmedContent) return; // Ignore empty messages
    if (trimmedContent.length > MAX_CHAT_MESSAGE_LENGTH) {
      sendToSocket(
        ws,
        MessageBuilders.error(`Message must be ${MAX_CHAT_MESSAGE_LENGTH} characters or less`),
      );
      return;
    }

    const message = MessageBuilders.chatMessage(
      trimmedContent,
      session.username,
      session.userId,
      session.room,
    );

    broadcastToRoom(this.roomManager.getSessions(), session.room, message);
  }
}
