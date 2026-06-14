import type {
  JoinMessage,
  UpdateSettingsMessage,
  UpdatePlaylistMessage,
  UserSession,
} from "../../shared/types";
import { MAX_USERNAME_LENGTH, ROOM_CODE_REGEX, SETTINGS_LIMITS } from "../../shared/constants";
import { clamp } from "../../shared/utils";
import type { WsContext } from "./utils";
import {
  getSessionOrError,
  validateHost,
  getAllUsers,
  findSessionByUserId,
  getUnifiedRoomState,
} from "./utils";
import { MessageBuilders } from "./messageBuilders";
import { broadcastToRoom, sendToSocket } from "./broadcast";

export async function handleJoinRoom(
  ctx: WsContext,
  ws: WebSocket,
  data: JoinMessage,
): Promise<void> {
  const { username, room, userId, userImage } = data;

  if (!username || !room || !userId) {
    sendToSocket(ws, MessageBuilders.error("Missing required fields: username, room, or userId"));
    return;
  }

  if (!ROOM_CODE_REGEX.test(room)) {
    sendToSocket(ws, MessageBuilders.error("Invalid room code format"));
    return;
  }

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

  const existingWs = findSessionByUserId(ctx.sessions, userId);
  if (existingWs) {
    ctx.sessions.delete(existingWs);
    try {
      existingWs.close();
    } catch {
      /* ignore */
    }
  }

  const existingPlayers = getAllUsers(ctx.sessions);
  const isFirstPlayer = existingPlayers.length === 0;

  const session: UserSession = {
    username: trimmedUsername,
    room,
    userId,
    userImage: userImage || null,
    isHost: isFirstPlayer,
    isReady: false,
    joinedAt: Date.now(),
  };

  ctx.sessions.set(ws, session);
  ws.serializeAttachment(session);

  const roomUsers = getAllUsers(ctx.sessions);

  const joinMessage = MessageBuilders.userJoined(
    trimmedUsername,
    userId,
    room,
    isFirstPlayer,
    roomUsers,
  );
  broadcastToRoom(ctx.sessions, joinMessage);

  const gamePhase = ctx.gameEngine.getPhase();
  if (gamePhase !== "lobby") {
    ctx.gameEngine.addPlayer(userId, trimmedUsername, userImage || undefined);
  }

  const unifiedState = getUnifiedRoomState(ctx, room);
  sendToSocket(ws, MessageBuilders.unifiedRoomState(unifiedState));
}

export async function handleLeave(ctx: WsContext, ws: WebSocket): Promise<void> {
  const session = ctx.sessions.get(ws);
  if (!session) return;

  const { username, room, userId, isHost } = session;
  const remainingUserEntries = Array.from(ctx.sessions.entries()).filter(([s]) => s !== ws);
  ctx.sessions.delete(ws);

  if (isHost && remainingUserEntries.length > 0) {
    const [newHostWs, newHostSession] = remainingUserEntries[0]!;
    newHostSession.isHost = true;
    ctx.sessions.set(newHostWs, newHostSession);
    newHostWs.serializeAttachment(newHostSession);

    const hostChangedMessage = MessageBuilders.gameEvent(
      "host_changed",
      "crown",
      `${newHostSession.username} is now the host`,
      { newHostId: newHostSession.userId, newHostName: newHostSession.username },
    );
    broadcastToRoom(ctx.sessions, hostChangedMessage);
  }

  const roomUsers = getAllUsers(ctx.sessions);
  if (roomUsers.length === 0) return;

  const leaveMessage = MessageBuilders.userLeft(username, userId, room, roomUsers);
  broadcastToRoom(ctx.sessions, leaveMessage);
}

export async function handleReady(ctx: WsContext, ws: WebSocket): Promise<void> {
  const session = ctx.sessions.get(ws);
  if (!session) return;

  session.isReady = !session.isReady;
  ctx.sessions.set(ws, session);

  const users = getAllUsers(ctx.sessions);
  broadcastToRoom(ctx.sessions, MessageBuilders.usersUpdated(users));
}

export async function handleUpdateSettings(
  ctx: WsContext,
  ws: WebSocket,
  data: UpdateSettingsMessage,
): Promise<void> {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;
  if (!validateHost(ws, session)) return;
  if (ctx.gameEngine.getPhase() !== "lobby") {
    sendToSocket(ws, MessageBuilders.error("Cannot change settings while a game is in progress"));
    return;
  }

  const { rounds, timePerRound, audioTime } = data.payload || {};
  if (rounds !== undefined) {
    ctx.roomSettings.rounds = clamp(rounds, SETTINGS_LIMITS.rounds.min, SETTINGS_LIMITS.rounds.max);
  }
  if (timePerRound !== undefined) {
    ctx.roomSettings.timePerRound = clamp(
      timePerRound,
      SETTINGS_LIMITS.timePerRound.min,
      SETTINGS_LIMITS.timePerRound.max,
    );
  }
  if (audioTime !== undefined) {
    ctx.roomSettings.audioTime = clamp(
      audioTime,
      SETTINGS_LIMITS.audioTime.min,
      SETTINGS_LIMITS.audioTime.max,
    );
  }
  if (ctx.roomSettings.audioTime > ctx.roomSettings.timePerRound) {
    ctx.roomSettings.audioTime = ctx.roomSettings.timePerRound;
  }

  broadcastToRoom(ctx.sessions, MessageBuilders.settingsUpdated(ctx.roomSettings));
}

export async function handleUpdatePlaylist(
  ctx: WsContext,
  ws: WebSocket,
  data: UpdatePlaylistMessage,
): Promise<void> {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;
  if (!validateHost(ws, session)) return;
  if (ctx.gameEngine.getPhase() !== "lobby") {
    sendToSocket(ws, MessageBuilders.error("Cannot change playlist while a game is in progress"));
    return;
  }

  const { playlist } = data.payload || {};
  if (!playlist) return;
  ctx.roomPlaylist = playlist;
  broadcastToRoom(ctx.sessions, MessageBuilders.playlistUpdated(playlist));
}
