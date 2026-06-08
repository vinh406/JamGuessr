import { RoomManager } from ".";
import { MessageBuilders, broadcastToRoom, sendToSocket } from ".";
import type { AnswerMessage, VotePlayAgainMessage, Song } from "../../shared/types";
import { SCORING } from "../../shared/constants";
import { getPlaylistTracks, getTrackPreviewUrl } from "../services/spotify/playlists";
import { shuffleArray } from "../../shared/utils";
import { createLibraryService } from "../services/library/LibraryService";
import { getSessionOrError, validateHost } from "./utils";

const PREVIEW_CONCURRENCY = 10;

async function ensurePreviewsForGame(songs: Song[], needed: number): Promise<Song[]> {
  const withPreview: Song[] = [];
  const withoutPreview: Song[] = [];

  for (const song of songs) {
    if (song.previewUrl) {
      withPreview.push(song);
    } else {
      withoutPreview.push(song);
    }
  }

  if (withPreview.length >= needed) {
    return [...withPreview, ...withoutPreview];
  }

  const newlyFetched: Song[] = [];
  for (
    let i = 0;
    i < withoutPreview.length && withPreview.length + newlyFetched.length < needed;
    i += PREVIEW_CONCURRENCY
  ) {
    const batch = withoutPreview.slice(i, i + PREVIEW_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (song) => {
        const url = await getTrackPreviewUrl(song.id);
        return url ? { ...song, previewUrl: url } : null;
      }),
    );
    for (const result of results) {
      if (result) newlyFetched.push(result);
    }
  }

  const fetchedIds = new Set(newlyFetched.map((s) => s.id));
  const stillWithout = withoutPreview.filter((s) => !fetchedIds.has(s.id));

  return [...withPreview, ...newlyFetched, ...stillWithout];
}

export class GameHandler {
  private voteTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private roomManager: RoomManager) {}

  async handleStartGame(ws: WebSocket): Promise<void> {
    const session = getSessionOrError(this.roomManager, ws);
    if (!session) return;

    if (!validateHost(ws, session)) return;

    if (!this.roomManager.tryStartGame()) {
      sendToSocket(ws, MessageBuilders.error("Game is already starting or in progress"));
      return;
    }

    const roomUsers = this.roomManager.getAllUsers();

    if (roomUsers.length < 1) {
      this.roomManager.cancelStartGame();
      sendToSocket(ws, MessageBuilders.error("Need at least 1 player to start"));
      return;
    }

    const settings = this.roomManager.getRoomSettings();
    const roomPlaylist = this.roomManager.getRoomPlaylist();

    // Broadcast game_started immediately so all clients see "Game starting..."
    broadcastToRoom(
      this.roomManager.getSessions(),
      MessageBuilders.gameStarted(settings.rounds, settings.timePerRound, settings.audioTime),
    );

    let songs: Song[] = [];
    const dbUrl = this.roomManager.getDatabaseUrl();
    const lib = createLibraryService(dbUrl);
    if (roomPlaylist?.id) {
      if (roomPlaylist.id === "blend") {
        const userIds = roomUsers.map((u) => u.userId);
        const targetCount = Math.max(settings.rounds * 2, 20);
        const result = await lib.getRoomBlendedPlaylist(userIds, targetCount, {
          minTracksPerUser: 5,
        });
        songs = result.songs;
        if (result.warnings.length > 0) {
          for (const warning of result.warnings) {
            sendToSocket(ws, MessageBuilders.error(warning));
          }
        }
      } else {
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
    }

    // Shuffle once, then ensure first `rounds` songs have previews
    songs = shuffleArray(songs);
    songs = await ensurePreviewsForGame(songs, settings.rounds);

    const songsWithPreviews = songs.filter((s) => s.previewUrl);
    if (songsWithPreviews.length < settings.rounds) {
      this.roomManager.cancelStartGame();
      sendToSocket(
        ws,
        MessageBuilders.error("Not enough songs available. Please set a larger Spotify playlist."),
      );
      broadcastToRoom(
        this.roomManager.getSessions(),
        MessageBuilders.unifiedRoomState(this.roomManager.getUnifiedRoomState(session.room)),
      );
      return;
    }

    this.roomManager.initGame(songs, settings.rounds);

    this.handleStartRoundInternal(session.room);
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
    broadcastToRoom(this.roomManager.getSessions(), roundStartedMessage);
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
      broadcastToRoom(this.roomManager.getSessions(), roundEndedMessage);

      const leaderboardMessage = MessageBuilders.leaderboardUpdate(scores);
      broadcastToRoom(this.roomManager.getSessions(), leaderboardMessage);

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
      broadcastToRoom(this.roomManager.getSessions(), roundEndedMessage);

      const leaderboardMessage = MessageBuilders.leaderboardUpdate(scores);
      broadcastToRoom(this.roomManager.getSessions(), leaderboardMessage);

      // Setup the timer to return to lobby
      if (this.voteTimer) clearTimeout(this.voteTimer);
      this.voteTimer = setTimeout(() => {
        if (this.roomManager.getVoteEndsAt()) {
          this.returnToLobby(room);
        }
        this.voteTimer = null;
      }, SCORING.VOTE_DURATION);
    }
  }

  async handleVote(ws: WebSocket, data: VotePlayAgainMessage): Promise<void> {
    const session = getSessionOrError(this.roomManager, ws);
    if (!session) return;

    if (!this.roomManager.getVoteEndsAt()) {
      sendToSocket(ws, MessageBuilders.error("No active vote at this time"));
      return;
    }

    this.roomManager.recordVote(session.userId, data.vote);

    const votes = this.roomManager.getVotes();
    const voteEndsAt = this.roomManager.getVoteEndsAt() || 0;
    const voteUpdateMessage = MessageBuilders.voteUpdate(votes, voteEndsAt);
    broadcastToRoom(this.roomManager.getSessions(), voteUpdateMessage);

    if (!data.vote) {
      // Someone voted NO, immediately return to lobby after a short delay
      if (this.voteTimer) clearTimeout(this.voteTimer);
      this.voteTimer = setTimeout(() => {
        this.returnToLobby(session.room);
        this.voteTimer = null;
      }, 3000);
      return;
    }

    if (this.roomManager.allPlayersVoted()) {
      if (this.roomManager.didAllPlayersVoteYes()) {
        if (this.voteTimer) clearTimeout(this.voteTimer);
        this.voteTimer = null;
        await this.handleContinueGame(session.room);
      } else {
        // Not everyone voted yes
        if (this.voteTimer) clearTimeout(this.voteTimer);
        this.voteTimer = setTimeout(() => {
          this.returnToLobby(session.room);
          this.voteTimer = null;
        }, 3000);
      }
    }
  }

  private async handleContinueGame(room: string): Promise<void> {
    const settings = this.roomManager.getRoomSettings();
    const roomPlaylist = this.roomManager.getRoomPlaylist();

    // For blend, regenerate fresh songs from the library each time
    if (roomPlaylist?.id === "blend") {
      const gameState = this.roomManager.getUnifiedRoomState(room).game;
      const playedSpotifyIds = gameState.songs.map((s) => s.id);
      const roomUsers = this.roomManager.getAllUsers();
      const userIds = roomUsers.map((u) => u.userId);
      const targetCount = Math.max(settings.rounds * 2, 20);
      const dbUrl = this.roomManager.getDatabaseUrl();
      const lib = createLibraryService(dbUrl);
      const result = await lib.getRoomBlendedPlaylist(userIds, targetCount, {
        minTracksPerUser: 5,
        excludeSpotifyIds: playedSpotifyIds,
      });
      let songs = result.songs;

      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          broadcastToRoom(
            this.roomManager.getSessions(),
            MessageBuilders.error(warning),
          );
        }
      }

      songs = shuffleArray(songs);
      songs = await ensurePreviewsForGame(songs, settings.rounds);

      const songsWithPreviews = songs.filter((s) => s.previewUrl);
      if (songsWithPreviews.length < settings.rounds) {
        broadcastToRoom(
          this.roomManager.getSessions(),
          MessageBuilders.error(
            "Not enough songs available. Please set a larger Spotify playlist.",
          ),
        );
        return;
      }

      this.roomManager.initGame(songs, settings.rounds, false);

      const gameStartedMessage = MessageBuilders.gameStarted(
        settings.rounds,
        settings.timePerRound,
        settings.audioTime,
      );
      broadcastToRoom(this.roomManager.getSessions(), gameStartedMessage);

      setTimeout(() => {
        this.handleStartRoundInternal(room);
      }, 2000);
      return;
    }

    const gameState = this.roomManager.getUnifiedRoomState(room).game;
    const remaining = gameState.songs.slice(gameState.currentSongIndex);

    if (remaining.length < settings.rounds) {
      const errorMessage = MessageBuilders.error(
        "Not enough songs available. Please set a larger Spotify playlist.",
      );
      broadcastToRoom(this.roomManager.getSessions(), errorMessage);
      return;
    }

    const ensured = await ensurePreviewsForGame(remaining, settings.rounds);
    const enoughWithPreviews = ensured.slice(0, settings.rounds).every((s) => s.previewUrl);
    if (!enoughWithPreviews) {
      const errorMessage = MessageBuilders.error(
        "Not enough songs available. Please set a larger Spotify playlist.",
      );
      broadcastToRoom(this.roomManager.getSessions(), errorMessage);
      return;
    }

    // Rebuild full song list: played songs + reordered remaining songs (previews at front)
    const played = gameState.songs.slice(0, gameState.currentSongIndex);
    const allSongs = [...played, ...ensured];

    this.roomManager.initGame(allSongs, settings.rounds, true);

    const gameStartedMessage = MessageBuilders.gameStarted(
      settings.rounds,
      settings.timePerRound,
      settings.audioTime,
    );
    broadcastToRoom(this.roomManager.getSessions(), gameStartedMessage);

    setTimeout(() => {
      this.handleStartRoundInternal(room);
    }, 2000);
  }

  async handleAnswer(ws: WebSocket, data: AnswerMessage): Promise<void> {
    const session = getSessionOrError(this.roomManager, ws);
    if (!session) return;

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
    broadcastToRoom(this.roomManager.getSessions(), leaderboardMessage);

    this.roomManager.checkAndEndRoundEarly(() =>
      this.handleEndRoundInternal(session.room),
    );
  }

  private returnToLobby(room: string): void {
    this.roomManager.resetGame();
    const unifiedState = this.roomManager.getUnifiedRoomState(room);
    broadcastToRoom(
      this.roomManager.getSessions(),
      MessageBuilders.unifiedRoomState(unifiedState),
    );
  }
}
