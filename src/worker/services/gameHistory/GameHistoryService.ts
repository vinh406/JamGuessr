import { eq, and } from "drizzle-orm";
import { getDb, type DbInstance } from "../../db";
import { gameResults, gamePlayers } from "../../db/schema";
import type { GameResult, GamePlayerResult } from "../../../shared/types";
import type { Song } from "../../../shared/types";

export function createGameHistoryService(connectionString: string) {
  let _db: DbInstance | null = null;
  function db(): DbInstance {
    if (!_db) _db = getDb(connectionString);
    return _db;
  }

  async function saveGame(params: {
    id: string;
    roomName: string;
    hostUserId: string;
    playlist: { name: string; imageUrl?: string; trackCount: number } | null;
    settings: { rounds: number; timePerRound: number; audioTime: number };
    songs: Song[];
    scores: { userId: string; username: string; score: number; streak: number }[];
    playedAt: Date;
  }): Promise<void> {
    const sorted = [...params.scores].sort((a, b) => b.score - a.score);
    const players = sorted.map((s, i) => ({
      id: crypto.randomUUID(),
      gameId: params.id,
      userId: s.userId || null,
      username: s.username || null,
      score: s.score,
      streak: s.streak,
      rank: i + 1,
    }));

    await db().transaction(async (tx) => {
      await tx.insert(gameResults).values({
        id: params.id,
        roomName: params.roomName,
        hostUserId: params.hostUserId,
        playlist: params.playlist,
        settings: params.settings,
        songs: params.songs,
        playedAt: params.playedAt,
      });
      await tx.insert(gamePlayers).values(players);
    });
  }

  async function getGamesListForUser(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<Array<GameResult & { playerCount: number }>> {
    const participations = await db().query.gamePlayers.findMany({
      where: eq(gamePlayers.userId, userId),
      columns: { gameId: true },
      limit,
      offset,
    });

    if (participations.length === 0) return [];

    const gameIds = participations.map((p) => p.gameId);

    const gamesWithPlayers = await db().query.gameResults.findMany({
      where: (gr, { inArray }) => inArray(gr.id, gameIds),
      with: {
        players: {
          columns: { id: true },
        },
      },
      orderBy: (gr, { desc }) => [desc(gr.playedAt)],
    });

    return gamesWithPlayers.map((g) => ({
      id: g.id,
      roomName: g.roomName,
      hostUserId: g.hostUserId,
      playlist: g.playlist,
      settings: g.settings,
      songs: g.songs as Song[],
      playedAt: g.playedAt.toISOString(),
      players: [],
      playerCount: g.players.length,
    }));
  }

  async function getGameById(
    gameId: string,
    userId: string,
  ): Promise<GameResult & { players: Array<GamePlayerResult & { displayName: string; image: string | null }> } | null> {
    // Verify participant
    const participant = await db().query.gamePlayers.findFirst({
      where: and(eq(gamePlayers.gameId, gameId), eq(gamePlayers.userId, userId)),
    });
    if (!participant) return null;

    const game = await db().query.gameResults.findFirst({
      where: eq(gameResults.id, gameId),
      with: {
        players: {
          with: {
            user: true,
          },
        },
      },
    });
    if (!game) return null;

    return {
      id: game.id,
      roomName: game.roomName,
      hostUserId: game.hostUserId,
      playlist: game.playlist,
      settings: game.settings,
      songs: game.songs as Song[],
      playedAt: game.playedAt.toISOString(),
      players: game.players.map((p) => {
        const displayName = p.user ? p.user.name : (p.username ?? "Guest");
        return {
          userId: p.userId,
          username: p.username,
          score: p.score,
          streak: p.streak,
          rank: p.rank,
          displayName,
          image: p.user?.image ?? null,
        };
      }),
    };
  }

  return { saveGame, getGamesListForUser, getGameById };
}
