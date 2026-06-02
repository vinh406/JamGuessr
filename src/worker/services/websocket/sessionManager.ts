import type { UserSession } from "../../../shared/types";

export class SessionManager {
  private sessions: Map<WebSocket, UserSession>;

  constructor(initialSessions?: Map<WebSocket, UserSession>) {
    this.sessions = initialSessions || new Map();
  }

  setSessions(sessions: Map<WebSocket, UserSession>): void {
    this.sessions = sessions;
  }

  getSessions(): Map<WebSocket, UserSession> {
    return this.sessions;
  }

  getUserSession(ws: WebSocket): UserSession | undefined {
    return this.sessions.get(ws);
  }

  setUserSession(ws: WebSocket, session: UserSession): void {
    this.sessions.set(ws, session);
  }

  removeUserSession(ws: WebSocket): void {
    this.sessions.delete(ws);
  }

  findSessionByUserId(userId: string, room: string): WebSocket | undefined {
    for (const [ws, session] of this.sessions.entries()) {
      if (session.userId === userId && session.room === room) {
        return ws;
      }
    }
    return undefined;
  }

  getUsersInRoom(room: string): UserSession[] {
    const users: UserSession[] = [];
    this.sessions.forEach((session) => {
      if (session.room === room) {
        users.push({ ...session });
      }
    });
    return users;
  }

  resetReadyStates(room: string): void {
    this.sessions.forEach((session, ws) => {
      if (session.room === room) {
        session.isReady = false;
        ws.serializeAttachment({ ...session });
      }
    });
  }
}
