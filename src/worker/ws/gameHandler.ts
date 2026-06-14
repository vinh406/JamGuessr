import type { AnswerMessage, VotePlayAgainMessage, Song } from "../../shared/types";
import { SCORING } from "../../shared/constants";
import { getPlaylistTracks, getTrackPreviewUrl } from "../services/spotify/playlists";
import { shuffleArray } from "../../shared/utils";
import { createLibraryService } from "../services/library/LibraryService";
import { createGameHistoryService } from "../services/gameHistory/GameHistoryService";
import type { WsContext } from "./utils";
import {
  getSessionOrError,
  validateHost,
  getAllUsers,
  getUnifiedRoomState,
  getHostUserId,
  resetReadyStates,
} from "./utils";
import { MessageBuilders } from "./messageBuilders";
import { broadcastToRoom, sendToSocket } from "./broadcast";
import { getDb } from "../db";

const PREVIEW_CONCURRENCY = 10;
const NOT_ENOUGH_SONGS_ERROR = "Not enough songs available. Please set a larger Spotify playlist.";

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

export async function handleStartGame(ctx: WsContext, ws: WebSocket): Promise<void> {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;
  if (!validateHost(ws, session)) return;

  if (ctx.gameEngine.getPhase() !== "lobby") {
    sendToSocket(ws, MessageBuilders.error("Game is already starting or in progress"));
    return;
  }
  ctx.gameEngine.setPhase("starting");

  const roomUsers = getAllUsers(ctx.sessions);
  if (roomUsers.length < 1) {
    ctx.gameEngine.setPhase("lobby");
    sendToSocket(ws, MessageBuilders.error("Need at least 1 player to start"));
    return;
  }

  broadcastToRoom(
    ctx.sessions,
    MessageBuilders.gameStarted(
      ctx.roomSettings.rounds,
      ctx.roomSettings.timePerRound,
      ctx.roomSettings.audioTime,
    ),
  );

  let songs: Song[] = [];
  const lib = createLibraryService(getDb(ctx.env.HYPERDRIVE.connectionString));
  if (ctx.roomPlaylist?.id) {
    if (ctx.roomPlaylist.id === "blend") {
      const userIds = roomUsers.map((u) => u.userId);
      const userInfoMap: Record<string, { userId: string; username: string; userImage?: string }> =
        {};
      for (const u of roomUsers) {
        userInfoMap[u.userId] = {
          userId: u.userId,
          username: u.username,
          userImage: u.userImage ?? undefined,
        };
      }
      const targetCount = Math.max(ctx.roomSettings.rounds * 2, 20);
      const result = await lib.getRoomBlendedPlaylist(userIds, targetCount, {
        minTracksPerUser: 5,
        userInfoMap,
      });
      songs = result.songs;
      if (result.warnings.length > 0) {
        for (const warning of result.warnings) {
          sendToSocket(ws, MessageBuilders.error(warning));
        }
      }
    } else {
      const libraryTracks = await lib.getLibraryPlaylistTracks(session.userId, ctx.roomPlaylist.id);
      if (libraryTracks.length > 0) {
        songs = libraryTracks;
      } else {
        songs = await getPlaylistTracks(ctx.roomPlaylist.id, true);
      }
    }
  }

  songs = shuffleArray(songs);
  songs = await ensurePreviewsForGame(songs, ctx.roomSettings.rounds);

  const songsWithPreviews = songs.filter((s) => s.previewUrl);
  if (songsWithPreviews.length < ctx.roomSettings.rounds) {
    ctx.gameEngine.setPhase("lobby");
    sendToSocket(ws, MessageBuilders.error(NOT_ENOUGH_SONGS_ERROR));
    broadcastToRoom(
      ctx.sessions,
      MessageBuilders.unifiedRoomState(getUnifiedRoomState(ctx, session.room!)),
    );
    return;
  }

  const players = getAllUsers(ctx.sessions).map((u) => ({
    userId: u.userId,
    username: u.username,
    userImage: u.userImage ?? undefined,
  }));
  ctx.gameEngine.initGame(songs, ctx.roomSettings.rounds, players);
  await handleStartRoundInternal(ctx, session.room!);
}

async function handleStartRoundInternal(ctx: WsContext, room: string): Promise<void> {
  const roundData = await ctx.gameEngine.startRound(ctx.roomSettings.timePerRound);

  if (ctx.roundTimer) clearTimeout(ctx.roundTimer);
  ctx.roundTimer = setTimeout(() => handleEndRoundInternal(ctx, room), roundData.duration);

  broadcastToRoom(
    ctx.sessions,
    MessageBuilders.roundStarted(
      roundData.round,
      roundData.totalRounds,
      { previewUrl: roundData.song.previewUrl, albumImageUrl: roundData.song.albumImageUrl },
      roundData.choices,
      roundData.startTime,
      roundData.endTime,
      roundData.duration,
    ),
  );
}

async function handleEndRoundInternal(ctx: WsContext, room: string): Promise<void> {
  if (ctx.roundTimer) {
    clearTimeout(ctx.roundTimer);
    ctx.roundTimer = null;
  }

  const roundThatJustEnded = ctx.gameEngine.getGameState().currentRound;
  const { correctAnswer, scores } = ctx.gameEngine.endRound();

  const currentRound = ctx.gameEngine.getGameState().currentRound;

  if (currentRound <= ctx.roomSettings.rounds) {
    const nextRoundAt = Date.now() + SCORING.ROUND_END_DELAY;
    broadcastToRoom(
      ctx.sessions,
      MessageBuilders.roundEnded(roundThatJustEnded, correctAnswer, scores, nextRoundAt),
    );
    broadcastToRoom(ctx.sessions, MessageBuilders.leaderboardUpdate(scores));

    setTimeout(() => handleStartRoundInternal(ctx, room), SCORING.ROUND_END_DELAY);
  } else {
    const roomUsers = getAllUsers(ctx.sessions);
    if (roomUsers.length >= 2) {
      try {
        const history = createGameHistoryService(getDb(ctx.env.HYPERDRIVE.connectionString));
        const songs = ctx.gameEngine.getSongs();
        const pScores = ctx.gameEngine.getScores();
        const hostUserId = getHostUserId(ctx.sessions);

        if (hostUserId) {
          await history.saveGame({
            id: crypto.randomUUID(),
            roomName: room,
            hostUserId,
            playlist: ctx.roomPlaylist
              ? {
                  name: ctx.roomPlaylist.name,
                  imageUrl: ctx.roomPlaylist.imageUrl,
                  trackCount: ctx.roomPlaylist.trackCount,
                }
              : null,
            settings: {
              rounds: ctx.roomSettings.rounds,
              timePerRound: ctx.roomSettings.timePerRound,
              audioTime: ctx.roomSettings.audioTime,
            },
            songs: songs.slice(0, ctx.roomSettings.rounds),
            scores: pScores.map((s) => ({
              userId: s.userId,
              username: s.username,
              score: s.score,
              streak: s.streak,
              bestStreak: s.bestStreak,
            })),
            playedAt: new Date(),
          });
        }
      } catch (err) {
        console.error("Failed to persist game history:", err);
      }
    }

    const { voteEndsAt } = ctx.gameEngine.endGame(SCORING.VOTE_DURATION);
    broadcastToRoom(
      ctx.sessions,
      MessageBuilders.roundEnded(
        roundThatJustEnded,
        correctAnswer,
        scores,
        undefined,
        true,
        voteEndsAt,
      ),
    );
    broadcastToRoom(ctx.sessions, MessageBuilders.leaderboardUpdate(scores));

    if (ctx.voteTimer) clearTimeout(ctx.voteTimer);
    ctx.voteTimer = setTimeout(() => {
      if (ctx.gameEngine.getVoteEndsAt()) returnToLobby(ctx, room);
      ctx.voteTimer = null;
    }, SCORING.VOTE_DURATION);
  }
}

export async function handleVote(
  ctx: WsContext,
  ws: WebSocket,
  data: VotePlayAgainMessage,
): Promise<void> {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;

  if (!ctx.gameEngine.getVoteEndsAt()) {
    sendToSocket(ws, MessageBuilders.error("No active vote at this time"));
    return;
  }

  ctx.gameEngine.recordVote(session.userId, data.vote);

  const votes = ctx.gameEngine.getVotes();
  const voteEndsAt = ctx.gameEngine.getVoteEndsAt() || 0;
  broadcastToRoom(ctx.sessions, MessageBuilders.voteUpdate(votes, voteEndsAt));

  if (!data.vote) {
    if (ctx.voteTimer) clearTimeout(ctx.voteTimer);
    ctx.voteTimer = setTimeout(() => {
      returnToLobby(ctx, session.room!);
      ctx.voteTimer = null;
    }, 3000);
    return;
  }

  const allUserIds = getAllUsers(ctx.sessions).map((u) => u.userId);
  if (ctx.gameEngine.allPlayersVoted(allUserIds)) {
    if (ctx.gameEngine.didAllPlayersVoteYes()) {
      if (ctx.voteTimer) clearTimeout(ctx.voteTimer);
      ctx.voteTimer = null;
      await handleContinueGame(ctx, session.room!);
    } else {
      if (ctx.voteTimer) clearTimeout(ctx.voteTimer);
      ctx.voteTimer = setTimeout(() => {
        returnToLobby(ctx, session.room!);
        ctx.voteTimer = null;
      }, 3000);
    }
  }
}

export async function handleAnswer(
  ctx: WsContext,
  ws: WebSocket,
  data: AnswerMessage,
): Promise<void> {
  const session = getSessionOrError(ctx.sessions, ws);
  if (!session) return;

  if (ctx.gameEngine.getPhase() !== "playing") {
    sendToSocket(ws, MessageBuilders.error("Game is not currently playing"));
    return;
  }

  const { isCorrect, points, streak } = ctx.gameEngine.recordAnswer(
    session.userId,
    data.choiceIndex,
    ctx.roomSettings.timePerRound,
  );

  sendToSocket(ws, MessageBuilders.answerResult(isCorrect, points, streak));
  broadcastToRoom(ctx.sessions, MessageBuilders.leaderboardUpdate(ctx.gameEngine.getScores()));

  if (!session.room) return;
  const playersInRoom = getAllUsers(ctx.sessions).map((u) => u.userId);
  if (ctx.gameEngine.allPlayersAnswered(playersInRoom)) {
    const state = ctx.gameEngine.getGameState();
    const timeElapsed = Date.now() - state.roundStartTime;
    const remainingTime = state.roundDuration - timeElapsed;
    if (remainingTime > SCORING.EARLY_ROUND_END_DELAY) {
      if (ctx.roundTimer) clearTimeout(ctx.roundTimer);
      ctx.roundTimer = setTimeout(
        () => handleEndRoundInternal(ctx, session.room!),
        SCORING.EARLY_ROUND_END_DELAY,
      );
    }
  }
}

async function handleContinueGame(ctx: WsContext, room: string): Promise<void> {
  if (ctx.roomPlaylist?.id === "blend") {
    const gameState = getUnifiedRoomState(ctx, room).game;
    const playedSpotifyIds = gameState.songs.map((s) => s.id);
    const roomUsers = getAllUsers(ctx.sessions);
    const userIds = roomUsers.map((u) => u.userId);
    const userInfoMap: Record<string, { userId: string; username: string; userImage?: string }> =
      {};
    for (const u of roomUsers) {
      userInfoMap[u.userId] = {
        userId: u.userId,
        username: u.username,
        userImage: u.userImage ?? undefined,
      };
    }
    const targetCount = Math.max(ctx.roomSettings.rounds * 2, 20);
    const lib = createLibraryService(getDb(ctx.env.HYPERDRIVE.connectionString));
    const result = await lib.getRoomBlendedPlaylist(userIds, targetCount, {
      minTracksPerUser: 5,
      excludeSpotifyIds: playedSpotifyIds,
      userInfoMap,
    });
    let songs = result.songs;

    if (result.warnings.length > 0) {
      for (const warning of result.warnings) {
        broadcastToRoom(ctx.sessions, MessageBuilders.error(warning));
      }
    }

    songs = shuffleArray(songs);
    songs = await ensurePreviewsForGame(songs, ctx.roomSettings.rounds);

    const songsWithPreviews = songs.filter((s) => s.previewUrl);
    if (songsWithPreviews.length < ctx.roomSettings.rounds) {
      broadcastToRoom(ctx.sessions, MessageBuilders.error(NOT_ENOUGH_SONGS_ERROR));
      return;
    }

    const players = getAllUsers(ctx.sessions).map((u) => ({
      userId: u.userId,
      username: u.username,
      userImage: u.userImage ?? undefined,
    }));
    ctx.gameEngine.initGame(songs, ctx.roomSettings.rounds, players, false);

    broadcastToRoom(
      ctx.sessions,
      MessageBuilders.gameStarted(
        ctx.roomSettings.rounds,
        ctx.roomSettings.timePerRound,
        ctx.roomSettings.audioTime,
      ),
    );
    setTimeout(() => handleStartRoundInternal(ctx, room), 2000);
    return;
  }

  const gameState = getUnifiedRoomState(ctx, room).game;
  const remaining = gameState.songs.slice(gameState.currentSongIndex);

  if (remaining.length < ctx.roomSettings.rounds) {
    broadcastToRoom(ctx.sessions, MessageBuilders.error(NOT_ENOUGH_SONGS_ERROR));
    return;
  }

  const ensured = await ensurePreviewsForGame(remaining, ctx.roomSettings.rounds);
  const enoughWithPreviews = ensured.slice(0, ctx.roomSettings.rounds).every((s) => s.previewUrl);
  if (!enoughWithPreviews) {
    broadcastToRoom(ctx.sessions, MessageBuilders.error(NOT_ENOUGH_SONGS_ERROR));
    return;
  }

  const played = gameState.songs.slice(0, gameState.currentSongIndex);
  const allSongs = [...played, ...ensured];

  const players = getAllUsers(ctx.sessions).map((u) => ({
    userId: u.userId,
    username: u.username,
    userImage: u.userImage ?? undefined,
  }));
  ctx.gameEngine.initGame(allSongs, ctx.roomSettings.rounds, players, true);

  broadcastToRoom(
    ctx.sessions,
    MessageBuilders.gameStarted(
      ctx.roomSettings.rounds,
      ctx.roomSettings.timePerRound,
      ctx.roomSettings.audioTime,
    ),
  );
  setTimeout(() => handleStartRoundInternal(ctx, room), 2000);
}

function returnToLobby(ctx: WsContext, room: string): void {
  if (ctx.roundTimer) {
    clearTimeout(ctx.roundTimer);
    ctx.roundTimer = null;
  }
  if (ctx.voteTimer) {
    clearTimeout(ctx.voteTimer);
    ctx.voteTimer = null;
  }
  resetReadyStates(ctx.sessions);
  ctx.gameEngine.reset();
  broadcastToRoom(ctx.sessions, MessageBuilders.unifiedRoomState(getUnifiedRoomState(ctx, room)));
}
