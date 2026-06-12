import type {
  UserSession,
  RoomSettings,
  Playlist,
  Song,
  SongChoice,
  PlayerScore,
  GamePhase,
  UnifiedRoomState,
} from "../../shared/types";
import { DEFAULT_ROOM_SETTINGS, SETTINGS_LIMITS, SCORING } from "../../shared/constants";
import { clamp } from "../../shared/utils";
import { SessionManager } from "./sessionManager";
import { GameEngine } from "./game/GameEngine";

export class RoomManager {
  private sessionManager: SessionManager;
  private gameEngine: GameEngine;
  private roomSettings: RoomSettings;
  private roomPlaylist: Playlist | null;
  private roundTimer: ReturnType<typeof setTimeout> | null = null;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.sessionManager = new SessionManager();
    this.gameEngine = new GameEngine();
    this.roomSettings = { ...DEFAULT_ROOM_SETTINGS };
    this.roomPlaylist = null;
    this.gameEngine.setLastFmApiKey(env.LAST_FM_API_KEY);
  }

  getDatabaseUrl(): string {
    return this.env.HYPERDRIVE.connectionString;
  }

  getPlaylistImportDO(): DurableObjectNamespace {
    return this.env.PLAYLIST_IMPORT_DO;
  }

  // Session Management delegation
  setSessions(sessions: Map<WebSocket, UserSession>): void {
    this.sessionManager.setSessions(sessions);
  }

  getSessions(): Map<WebSocket, UserSession> {
    return this.sessionManager.getSessions();
  }

  getUserSession(ws: WebSocket): UserSession | undefined {
    return this.sessionManager.getUserSession(ws);
  }

  setUserSession(ws: WebSocket, session: UserSession): void {
    this.sessionManager.setUserSession(ws, session);
  }

  removeUserSession(ws: WebSocket): void {
    this.sessionManager.removeUserSession(ws);
  }

  findSessionByUserId(userId: string): WebSocket | undefined {
    return this.sessionManager.findSessionByUserId(userId);
  }

  getAllUsers(): UserSession[] {
    return this.sessionManager.getAllUsers();
  }

  // Settings Management
  getRoomSettings(): RoomSettings {
    return this.roomSettings;
  }

  updateSettings(rounds?: number, timePerRound?: number, audioTime?: number): RoomSettings {
    if (rounds !== undefined) {
      this.roomSettings.rounds = clamp(
        rounds,
        SETTINGS_LIMITS.rounds.min,
        SETTINGS_LIMITS.rounds.max,
      );
    }
    if (timePerRound !== undefined) {
      this.roomSettings.timePerRound = clamp(
        timePerRound,
        SETTINGS_LIMITS.timePerRound.min,
        SETTINGS_LIMITS.timePerRound.max,
      );
    }
    if (audioTime !== undefined) {
      this.roomSettings.audioTime = clamp(
        audioTime,
        SETTINGS_LIMITS.audioTime.min,
        SETTINGS_LIMITS.audioTime.max,
      );
    }
    if (this.roomSettings.audioTime > this.roomSettings.timePerRound) {
      this.roomSettings.audioTime = this.roomSettings.timePerRound;
    }
    return this.roomSettings;
  }

  // Playlist Management
  getRoomPlaylist(): Playlist | null {
    return this.roomPlaylist;
  }

  setRoomPlaylist(playlist: Playlist | null): void {
    this.roomPlaylist = playlist;
  }

  // Game Management delegation
  setLastFmApiKey(apiKey: string): void {
    this.gameEngine.setLastFmApiKey(apiKey);
  }

  getCurrentGamePhase(): GamePhase {
    return this.gameEngine.getPhase();
  }

  getCurrentRound(): number {
    return this.gameEngine.getGameState().currentRound;
  }

  initGame(songs: Song[], rounds: number, isContinuing: boolean = false): void {
    const players = this.getAllUsers().map((u) => ({
      userId: u.userId,
      username: u.username,
      userImage: u.userImage ?? undefined,
    }));
    this.gameEngine.initGame(songs, rounds, players, isContinuing);
  }

  async startRound(endRoundCallback: () => void): Promise<{
    song: Song;
    choices: SongChoice[];
    round: number;
    totalRounds: number;
    startTime: number;
    endTime: number;
    duration: number;
  }> {
    const roundData = await this.gameEngine.startRound(this.roomSettings.timePerRound);

    if (this.roundTimer) clearTimeout(this.roundTimer);
    this.roundTimer = setTimeout(endRoundCallback, roundData.duration);

    return roundData;
  }

  checkAndEndRoundEarly(endRoundCallback: () => void): boolean {
    const playersInRoom = this.getAllUsers().map((u) => u.userId);
    if (this.gameEngine.allPlayersAnswered(playersInRoom)) {
      const state = this.gameEngine.getGameState();
      const timeElapsed = Date.now() - state.roundStartTime;
      const remainingTime = state.roundDuration - timeElapsed;

      if (remainingTime > SCORING.EARLY_ROUND_END_DELAY) {
        if (this.roundTimer) clearTimeout(this.roundTimer);
        // We don't update the roundEndTime in gameEngine here because it's authoritative for scoring
        // But we trigger the callback early.
        this.roundTimer = setTimeout(endRoundCallback, SCORING.EARLY_ROUND_END_DELAY);
        return true;
      }
    }
    return false;
  }

  recordAnswer(
    userId: string,
    choiceIndex: number,
  ): { isCorrect: boolean; points: number; streak: number } {
    return this.gameEngine.recordAnswer(userId, choiceIndex, this.roomSettings.timePerRound);
  }

  endRound(): { correctAnswer: SongChoice; scores: PlayerScore[] } {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    return this.gameEngine.endRound();
  }

  endGame(voteDurationMs: number): { finalScores: PlayerScore[]; voteEndsAt: number } {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    return this.gameEngine.endGame(voteDurationMs);
  }

  resetGame(): void {
    if (this.roundTimer) {
      clearTimeout(this.roundTimer);
      this.roundTimer = null;
    }
    this.gameEngine.reset();
    this.sessionManager.resetReadyStates();
  }

  recordVote(userId: string, vote: boolean): void {
    this.gameEngine.recordVote(userId, vote);
  }

  getVotes(): Record<string, boolean> {
    return this.gameEngine.getVotes();
  }

  getVoteEndsAt(): number | null {
    return this.gameEngine.getVoteEndsAt();
  }

  allPlayersVoted(): boolean {
    const playersInRoom = this.getAllUsers().map((u) => u.userId);
    return this.gameEngine.allPlayersVoted(playersInRoom);
  }

  didAllPlayersVoteYes(): boolean {
    return this.gameEngine.didAllPlayersVoteYes();
  }

  resetReadyStates(): void {
    this.sessionManager.resetReadyStates();
  }

  tryStartGame(): boolean {
    if (this.getCurrentGamePhase() !== "lobby") return false;
    this.gameEngine.setPhase("starting");
    return true;
  }

  cancelStartGame(): void {
    this.gameEngine.setPhase("lobby");
  }

  getScores(): PlayerScore[] {
    return this.gameEngine.getScores();
  }

  getSongs(): Song[] {
    return this.gameEngine.getSongs();
  }

  getHostUserId(): string | undefined {
    const users = this.getAllUsers();
    return users.find((u) => u.isHost)?.userId;
  }

  addPlayerToScores(userId: string, username: string, userImage?: string): void {
    this.gameEngine.addPlayer(userId, username, userImage);
  }

  getUnifiedRoomState(room: string): UnifiedRoomState {
    return {
      room,
      settings: this.roomSettings,
      playlist: this.roomPlaylist,
      users: this.getAllUsers(),
      game: this.gameEngine.getGameState(),
    };
  }
}
