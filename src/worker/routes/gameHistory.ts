import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../services/better-auth";
import { createGameHistoryService } from "../services/gameHistory/GameHistoryService";
import { getDb } from "../db";
import type { DbInstance } from "../db";

const ErrorSchema = z.object({
  error: z.string(),
});

const GamePlayerResultSchema = z.object({
  userId: z.string().nullable(),
  username: z.string().nullable(),
  score: z.number(),
  streak: z.number(),
  bestStreak: z.number(),
  rank: z.number(),
  displayName: z.string(),
  image: z.string().nullable(),
});

const GameResultSchema = z.object({
  id: z.string(),
  roomName: z.string(),
  hostUserId: z.string(),
  playlist: z
    .object({
      name: z.string(),
      imageUrl: z.string().optional(),
      trackCount: z.number(),
    })
    .nullable(),
  settings: z.object({
    rounds: z.number(),
    timePerRound: z.number(),
    audioTime: z.number(),
  }),
  songs: z.array(z.any()),
  players: z.array(GamePlayerResultSchema),
  playedAt: z.string(),
});

const GameListItemSchema = z.object({
  id: z.string(),
  roomName: z.string(),
  hostUserId: z.string(),
  playlist: GameResultSchema.shape.playlist,
  settings: GameResultSchema.shape.settings,
  playedAt: z.string(),
  playerCount: z.number(),
});

const PaginatedGamesSchema = z.object({
  games: z.array(GameListItemSchema),
  hasMore: z.boolean(),
});

function createGameHistoryHandlers() {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  const getAuthenticatedUser = async (c: { env: Env; req: { raw: Request } }, db: DbInstance) => {
    const authInstance = auth(c.env, db);
    const session = await authInstance.api.getSession(c.req.raw);
    return session?.user;
  };

  // GET / - list user's games
  const listGamesRoute = createRoute({
    method: "get",
    path: "/",
    request: {
      query: z.object({
        limit: z.coerce.number().optional().default(20),
        offset: z.coerce.number().optional().default(0),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: PaginatedGamesSchema } },
        description: "List of past games",
      },
      401: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["Game History"],
    summary: "List games",
    description: "Returns paginated game history for the authenticated user",
  });
  app.openapi(listGamesRoute, async (c) => {
    const db = getDb(c.env.HYPERDRIVE.connectionString);
    const user = await getAuthenticatedUser(c, db);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { limit, offset } = c.req.valid("query");
    const history = createGameHistoryService(db);
    const games = await history.getGamesListForUser(user.id, limit, offset);
    const hasMore = games.length === limit;

    return c.json(
      {
        games: games.map((g) => ({
          id: g.id,
          roomName: g.roomName,
          hostUserId: g.hostUserId,
          playlist: g.playlist,
          settings: g.settings,
          playedAt: g.playedAt,
          playerCount: g.playerCount,
        })),
        hasMore,
      },
      200,
    );
  });

  // GET /:id - single game detail
  const getGameRoute = createRoute({
    method: "get",
    path: "/:id",
    request: {
      params: z.object({
        id: z.string(),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: GameResultSchema } },
        description: "Game details",
      },
      401: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Unauthorized",
      },
      404: {
        content: { "application/json": { schema: ErrorSchema } },
        description: "Game not found or not a participant",
      },
    },
    tags: ["Game History"],
    summary: "Get game",
    description: "Returns full details for a single game (must be a participant)",
  });
  app.openapi(getGameRoute, async (c) => {
    const db = getDb(c.env.HYPERDRIVE.connectionString);
    const user = await getAuthenticatedUser(c, db);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    const history = createGameHistoryService(db);
    const game = await history.getGameById(id, user.id);
    if (!game) return c.json({ error: "Game not found" }, 404);

    return c.json(game, 200);
  });

  return app;
}

export const gameHistoryHandlers = createGameHistoryHandlers();
