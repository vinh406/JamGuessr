import { RoomManager } from "../lib/websocket";
import { MessageBuilders, broadcastToRoom, sendToSocket } from "../lib/websocket";
import type {
  UserSession,
  JoinMessage,
  UpdateSettingsMessage,
  UpdatePlaylistMessage,
} from "../../shared/types";
import { MAX_USERNAME_LENGTH, ROOM_CODE_REGEX } from "../../shared/constants";
import { validateHost } from "./utils";

export class RoomHandler {
  constructor(private roomManager: RoomManager) {}

  async handleJoinRoom(ws: WebSocket, data: JoinMessage): Promise<void> {
    const { username, room, userId, userImage } = data;

    // Validate required fields
    if (!username || !room || !userId) {
      sendToSocket(ws, MessageBuilders.error("Missing required fields: username, room, or userId"));
      return;
    }

    // Validate room code format
    if (!ROOM_CODE_REGEX.test(room)) {
      sendToSocket(ws, MessageBuilders.error("Invalid room code format"));
      return;
    }

    // Sanitize and validate username
    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      sendToSocket(ws, MessageBuilders.error("Username cannot be empty"));
      return;
    }
    if (trimmedUsername.length > MAX_USERNAME_LENGTH) {
      sendToSocket(
        ws,
        MessageBuilders.error(`Username must be ${MAX_USERNAME_LENGTH} characters or less`),
      );
      return;
    }

    // Check if user is already in this room - allow reconnection
    const existingWs = this.roomManager.findSessionByUserId(userId, room);
    if (existingWs) {
      // Remove existing session - user is reconnecting
      this.roomManager.removeUserSession(existingWs);
      try {
        existingWs.close();
      } catch {
        // Ignore close errors
      }
    }

    // Check if this is the first player (becomes host)
    const existingPlayers = this.roomManager.getUsersInRoom(room);
    const isFirstPlayer = existingPlayers.length === 0;

    // Create user session
    const session: UserSession = {
      username: trimmedUsername,
      room,
      userId,
      userImage: userImage || null,
      isHost: isFirstPlayer,
      isReady: false,
      joinedAt: Date.now(),
    };

    // Store session
    this.roomManager.setUserSession(ws, session);
    ws.serializeAttachment(session);

    // Get all users in room (including the new one)
    const roomUsers = this.roomManager.getUsersInRoom(room);

    // Notify all users in the room about the new player
    const joinMessage = MessageBuilders.userJoined(
      trimmedUsername,
      userId,
      room,
      isFirstPlayer,
      roomUsers,
    );
    broadcastToRoom(this.roomManager.getSessions(), room, joinMessage);

    // Add player to scores if game is already in progress
    const gamePhase = this.roomManager.getCurrentGamePhase();
    if (gamePhase !== "lobby") {
      this.roomManager.addPlayerToScores(userId, trimmedUsername, userImage || undefined);
    }

    // Send unified room state to joining player
    const unifiedState = this.roomManager.getUnifiedRoomState(room);
    sendToSocket(ws, MessageBuilders.unifiedRoomState(unifiedState));
  }

  async handleLeaveRoom(ws: WebSocket, session: UserSession): Promise<void> {
    const { username, room, userId, isHost } = session;

    // Get remaining users BEFORE deletion (need to find new host from these)
    const sessions = this.roomManager.getSessions();
    const remainingUserEntries = Array.from(sessions.entries()).filter(
      ([s, sess]) => s !== ws && sess.room === room,
    );

    // Remove user session FIRST
    this.roomManager.removeUserSession(ws);

    // Handle host transfer - find the WebSocket of the first remaining user
    if (isHost && remainingUserEntries.length > 0) {
      const [newHostWs, newHostSession] = remainingUserEntries[0]!;

      // Update the session object in the Map with new host status
      newHostSession.isHost = true;
      this.roomManager.setUserSession(newHostWs, newHostSession);

      // Update serialization for new host
      newHostWs.serializeAttachment(newHostSession);

      // Broadcast host change
      const hostChangedMessage = MessageBuilders.gameEvent(
        "host_changed",
        "crown",
        `${newHostSession.username} is now the host`,
        { newHostId: newHostSession.userId, newHostName: newHostSession.username },
      );
      broadcastToRoom(this.roomManager.getSessions(), room, hostChangedMessage);
    }

    // Get remaining users in the room (after host transfer)
    const roomUsers = this.roomManager.getUsersInRoom(room);

    // Notify remaining users with updated user list
    const leaveMessage = MessageBuilders.userLeft(username, userId, room, roomUsers);
    broadcastToRoom(this.roomManager.getSessions(), room, leaveMessage);
  }

  async handleReady(ws: WebSocket): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) return;

    // Toggle ready state
    session.isReady = !session.isReady;
    this.roomManager.setUserSession(ws, session);

    // Broadcast updated user list (includes ready state)
    const users = this.roomManager.getUsersInRoom(session.room);
    const usersMessage = MessageBuilders.usersUpdated(users);
    broadcastToRoom(this.roomManager.getSessions(), session.room, usersMessage);
  }

  async handleLeave(ws: WebSocket): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (session) {
      await this.handleLeaveRoom(ws, session);
    }
  }

  async handleUpdateSettings(ws: WebSocket, data: UpdateSettingsMessage): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) {
      sendToSocket(ws, MessageBuilders.error("You must join a room first"));
      return;
    }

    if (!validateHost(ws, session)) return;

    const { rounds, timePerRound, audioTime } = data.payload || {};
    const updatedSettings = this.roomManager.updateSettings(rounds, timePerRound, audioTime);

    // Broadcast settings update
    const settingsMessage = MessageBuilders.settingsUpdated(updatedSettings);
    broadcastToRoom(this.roomManager.getSessions(), session.room, settingsMessage);
  }

  async handleUpdatePlaylist(ws: WebSocket, data: UpdatePlaylistMessage): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) {
      sendToSocket(ws, MessageBuilders.error("You must join a room first"));
      return;
    }

    if (!validateHost(ws, session)) return;

    const { playlist } = data.payload || {};
    if (!playlist) return;

    this.roomManager.setRoomPlaylist(playlist);

    // Broadcast playlist update
    const playlistMessage = MessageBuilders.playlistUpdated(playlist);
    broadcastToRoom(this.roomManager.getSessions(), session.room, playlistMessage);
  }
}
