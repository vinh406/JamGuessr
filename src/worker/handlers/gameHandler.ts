import { RoomManager } from "../lib/websocket";
import { MessageBuilders, broadcastToRoom, sendToSocket } from "../lib/websocket";
import type { AnswerMessage, VotePlayAgainMessage, Song, UserSession } from "../../shared/types";
import { SCORING } from "../../shared/constants";
import { getPlaylistTracks, getTrackPreviewUrl } from "../lib/spotify/playlists";
import { shuffleArray } from "../lib/websocket/game/GameUtils";
import { createLibraryService } from "../lib/library/LibraryService";

const PREVIEW_CONCURRENCY = 5;

async function ensurePreviewsForGame(songs: Song[], needed: number): Promise<Song[]> {
  const shuffled = shuffleArray(songs);
  const pool = shuffled.slice(0, Math.min(shuffled.length, needed * 5));

  const needPreview: { song: Song; index: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    if (!pool[i]!.previewUrl) {
      needPreview.push({ song: pool[i]!, index: i });
    }
  }

  for (let i = 0; i < needPreview.length; i += PREVIEW_CONCURRENCY) {
    const batch = needPreview.slice(i, i + PREVIEW_CONCURRENCY);
    await Promise.all(
      batch.map(async ({ song, index }) => {
        const url = await getTrackPreviewUrl(song.id);
        pool[index] = { ...song, previewUrl: url };
      }),
    );
  }

  const valid: Song[] = [];
  for (const song of pool) {
    if (valid.length >= needed) break;
    if (song.previewUrl) valid.push(song);
  }

  return valid;
}

export class GameHandler {
  private voteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private roomManager: RoomManager) {}

  async handleStartGame(ws: WebSocket): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) {
      sendToSocket(ws, MessageBuilders.error("You must join a room first"));
      return;
    }

    if (!this.validateHost(ws, session)) return;

    if (!this.roomManager.tryStartGame()) {
      sendToSocket(ws, MessageBuilders.error("Game is already starting or in progress"));
      return;
    }

    const roomUsers = this.roomManager.getUsersInRoom(session.room);

    if (roomUsers.length < 1) {
      this.roomManager.cancelStartGame();
      sendToSocket(ws, MessageBuilders.error("Need at least 1 player to start"));
      return;
    }

    const settings = this.roomManager.getRoomSettings();
    const roomPlaylist = this.roomManager.getRoomPlaylist();

    let songs: Song[] = [];
    if (roomPlaylist?.id) {
      // Try library first
      const dbUrl = this.roomManager.getDatabaseUrl();
      const lib = createLibraryService(dbUrl);
      const libraryTracks = await lib.getLibraryPlaylistTracks(session.userId, roomPlaylist.id);
      if (libraryTracks.length > 0) {
        songs = libraryTracks;
      } else {
        songs = await getPlaylistTracks(
          roomPlaylist.id,
          this.roomManager.getPlaylistImportDO(),
          true,
        );
      }
    }

    // Filter to only songs with audio previews — ensures all game rounds play audio
    songs = await ensurePreviewsForGame(songs, settings.rounds);

    if (songs.length < settings.rounds) {
      this.roomManager.cancelStartGame();
      sendToSocket(
        ws,
        MessageBuilders.error("Not enough songs available. Please set a larger Spotify playlist."),
      );
      return;
    }

    this.roomManager.initGame(songs, settings.rounds, session.room);

    const gameStartedMessage = MessageBuilders.gameStarted(
      settings.rounds,
      settings.timePerRound,
      settings.audioTime,
    );
    broadcastToRoom(this.roomManager.getSessions(), session.room, gameStartedMessage);

    setTimeout(() => {
      this.handleStartRoundInternal(session.room);
    }, 2000);
  }

  private async handleStartRoundInternal(room: string): Promise<void> {
    const roundData = await this.roomManager.startRound(() => this.handleEndRoundInternal(room));

    const songData = {
      previewUrl: roundData.song.previewUrl,
      albumImageUrl: roundData.song.albumImageUrl,
    };

    const roundStartedMessage = MessageBuilders.roundStarted(
      roundData.round,
      roundData.totalRounds,
      songData,
      roundData.choices,
      roundData.startTime,
      roundData.endTime,
      roundData.duration,
    );
    broadcastToRoom(this.roomManager.getSessions(), room, roundStartedMessage);
  }

  private handleEndRoundInternal(room: string): void {
    const roundThatJustEnded = this.roomManager.getCurrentRound();
    const { correctAnswer, scores } = this.roomManager.endRound();

    const settings = this.roomManager.getRoomSettings();
    const totalRounds = settings.rounds;
    const currentRound = this.roomManager.getCurrentRound();

    if (currentRound <= totalRounds) {
      const nextRoundAt = Date.now() + SCORING.ROUND_END_DELAY;
      const roundEndedMessage = MessageBuilders.roundEnded(
        roundThatJustEnded,
        correctAnswer,
        scores,
        nextRoundAt,
      );
      broadcastToRoom(this.roomManager.getSessions(), room, roundEndedMessage);

      const leaderboardMessage = MessageBuilders.leaderboardUpdate(scores);
      broadcastToRoom(this.roomManager.getSessions(), room, leaderboardMessage);

      setTimeout(() => {
        this.handleStartRoundInternal(room);
      }, SCORING.ROUND_END_DELAY);
    } else {
      // For the last round, transition to game end phase first to get final state
      const { voteEndsAt } = this.roomManager.endGame(SCORING.VOTE_DURATION);

      // Send a single merged message for both round and game end
      const roundEndedMessage = MessageBuilders.roundEnded(
        roundThatJustEnded,
        correctAnswer,
        scores,
        undefined, // nextRoundAt
        true, // isFinal
        voteEndsAt,
      );
      broadcastToRoom(this.roomManager.getSessions(), room, roundEndedMessage);

      const leaderboardMessage = MessageBuilders.leaderboardUpdate(scores);
      broadcastToRoom(this.roomManager.getSessions(), room, leaderboardMessage);

      // Setup the timer to return to lobby
      if (this.voteTimer) clearTimeout(this.voteTimer);
      this.voteTimer = setTimeout(() => {
        // Only reset if we're still in the voting period and it hasn't been reset yet
        if (this.roomManager.getVoteEndsAt()) {
          this.roomManager.resetGame(room);
          const unifiedState = this.roomManager.getUnifiedRoomState(room);
          broadcastToRoom(
            this.roomManager.getSessions(),
            room,
            MessageBuilders.unifiedRoomState(unifiedState),
          );
        }
        this.voteTimer = null;
      }, SCORING.VOTE_DURATION);
    }
  }

  async handleVote(ws: WebSocket, data: VotePlayAgainMessage): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) {
      sendToSocket(ws, MessageBuilders.error("You must join a room first"));
      return;
    }

    if (!this.roomManager.getVoteEndsAt()) {
      sendToSocket(ws, MessageBuilders.error("No active vote at this time"));
      return;
    }

    this.roomManager.recordVote(session.userId, data.vote);

    const votes = this.roomManager.getVotes();
    const voteEndsAt = this.roomManager.getVoteEndsAt() || 0;
    const voteUpdateMessage = MessageBuilders.voteUpdate(votes, voteEndsAt);
    broadcastToRoom(this.roomManager.getSessions(), session.room, voteUpdateMessage);

    if (!data.vote) {
      // Someone voted NO, immediately return to lobby after a short delay
      if (this.voteTimer) clearTimeout(this.voteTimer);
      this.voteTimer = setTimeout(() => {
        this.roomManager.resetGame(session.room);
        const unifiedState = this.roomManager.getUnifiedRoomState(session.room);
        broadcastToRoom(
          this.roomManager.getSessions(),
          session.room,
          MessageBuilders.unifiedRoomState(unifiedState),
        );
        this.voteTimer = null;
      }, 3000);
      return;
    }

    if (this.roomManager.allPlayersVoted(session.room)) {
      if (this.roomManager.didAllPlayersVoteYes()) {
        if (this.voteTimer) clearTimeout(this.voteTimer);
        this.voteTimer = null;
        await this.handleContinueGame(session.room);
      } else {
        // Not everyone voted yes
        if (this.voteTimer) clearTimeout(this.voteTimer);
        this.voteTimer = setTimeout(() => {
          this.roomManager.resetGame(session.room);
          const unifiedState = this.roomManager.getUnifiedRoomState(session.room);
          broadcastToRoom(
            this.roomManager.getSessions(),
            session.room,
            MessageBuilders.unifiedRoomState(unifiedState),
          );
          this.voteTimer = null;
        }, 3000);
      }
    }
  }

  private async handleContinueGame(room: string): Promise<void> {
    const settings = this.roomManager.getRoomSettings();
    const roomPlaylist = this.roomManager.getRoomPlaylist();

    let songs: Song[] = [];
    if (roomPlaylist?.id) {
      songs = await getPlaylistTracks(roomPlaylist.id, this.roomManager.getPlaylistImportDO());
    }

    // Check if there are enough unused songs to play another full game
    const gameState = this.roomManager.getUnifiedRoomState(room).game;
    const remainingSongs = gameState.songs.length - gameState.currentSongIndex;
    if (remainingSongs < settings.rounds) {
      const errorMessage = MessageBuilders.error(
        "Not enough songs available. Please set a larger Spotify playlist.",
      );
      broadcastToRoom(this.roomManager.getSessions(), room, errorMessage);
      return;
    }

    // We pass isContinuing=true to keep the songs list and index
    this.roomManager.initGame(songs, settings.rounds, room, true);

    const gameStartedMessage = MessageBuilders.gameStarted(
      settings.rounds,
      settings.timePerRound,
      settings.audioTime,
    );
    broadcastToRoom(this.roomManager.getSessions(), room, gameStartedMessage);

    setTimeout(() => {
      this.handleStartRoundInternal(room);
    }, 2000);
  }

  async handleAnswer(ws: WebSocket, data: AnswerMessage): Promise<void> {
    const session = this.roomManager.getUserSession(ws);
    if (!session) {
      sendToSocket(ws, MessageBuilders.error("You must join a room first"));
      return;
    }

    if (this.roomManager.getCurrentGamePhase() !== "playing") {
      sendToSocket(ws, MessageBuilders.error("Game is not currently playing"));
      return;
    }

    const { isCorrect, points, streak } = this.roomManager.recordAnswer(
      session.userId,
      data.choiceIndex,
    );

    const answerResultMessage = MessageBuilders.answerResult(isCorrect, points, streak);
    sendToSocket(ws, answerResultMessage);

    const scores = this.roomManager.getScores();
    const leaderboardMessage = MessageBuilders.leaderboardUpdate(scores);
    broadcastToRoom(this.roomManager.getSessions(), session.room, leaderboardMessage);

    this.roomManager.checkAndEndRoundEarly(session.room, () =>
      this.handleEndRoundInternal(session.room),
    );
  }

  private validateHost(ws: WebSocket, session: UserSession): boolean {
    if (!session.isHost) {
      sendToSocket(ws, MessageBuilders.error("Only the host can perform this action"));
      return false;
    }
    return true;
  }
}
