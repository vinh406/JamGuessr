import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { auth } from "./services/better-auth";
import { libraryHandlers } from "./services/library/libraryHandlers";
import { getCurrentUserPlaylists } from "./services/spotify/playlists";
export { WebSocketHibernationServer } from "./durable-objects/websocketDurableObject";
export { PlaylistImportDO } from "./durable-objects/playlistImportDO";

const app = new OpenAPIHono<{ Bindings: Env }>();

app.use("*", (c, next) => {
  return cors({
    origin: [c.env.BETTER_AUTH_URL],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});

// Response schemas
const HealthResponseSchema = z
  .object({
    status: z.string().openapi({ description: "Health status", example: "ok" }),
  })
  .openapi("HealthResponse");

const PlaylistsResponseSchema = z
  .object({
    playlists: z
      .array(
        z.object({
          id: z
            .string()
            .openapi({ description: "Spotify playlist ID", example: "37i9dQZF1DXcBWIGoYBM5M" }),
          name: z.string().openapi({ description: "Playlist name", example: "Today's Top Hits" }),
          description: z.string().optional().openapi({ description: "Playlist description" }),
          imageUrl: z.string().optional().openapi({ description: "Playlist cover image URL" }),
          trackCount: z.number().optional().openapi({ description: "Total number of tracks" }),
          ownerId: z.string().optional().openapi({ description: "Playlist owner ID" }),
          spotifyUrl: z
            .string()
            .optional()
            .openapi({ description: "Spotify URL for the playlist" }),
        }),
      )
      .openapi({ description: "Array of user's Spotify playlists" }),
  })
  .openapi("PlaylistsResponse");

// Health check endpoint
const healthRoute = createRoute({
  method: "get",
  path: "/ok",
  responses: {
    200: {
      content: { "application/json": { schema: HealthResponseSchema } },
      description: "Service is healthy",
    },
  },
  tags: ["Health"],
  summary: "Health check",
  description: "Returns OK status to indicate the service is running properly",
});
app.openapi(healthRoute, (c) => c.json({ status: "ok" }));

// Library API endpoints
app.route("/api/library", libraryHandlers);

// Better Auth handler
app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return auth(c.env).handler(c.req.raw);
});

// Get user playlists endpoint
const getPlaylistsRoute = createRoute({
  method: "get",
  path: "/api/playlists",
  responses: {
    200: {
      content: { "application/json": { schema: PlaylistsResponseSchema } },
      description: "List of user's playlists",
    },
  },
  tags: ["Playlists"],
  summary: "Get user playlists",
  description: "Retrieve all Spotify playlists for the authenticated user",
});
app.openapi(getPlaylistsRoute, async (c) => {
  const authInstance = auth(c.env);
  const session = await authInstance.api.getSession(c.req.raw);

  const playlists = session?.user ? await getCurrentUserPlaylists(session.user.id, c.env) : [];

  return c.json({ playlists });
});

// OpenAPI documentation endpoint (Swagger UI)
app.doc("/api/doc", {
  openapi: "3.0.0",
  info: {
    version: "1.0.0",
    title: "SpotiGuess API",
    description: "API for SpotiGuess - a music guessing game app",
  },
  servers: [{ url: "/", description: "Current server" }],
  tags: [
    { name: "Health", description: "Health check endpoints" },
    { name: "Playlists", description: "Spotify playlist operations" },
    { name: "Library", description: "User library management" },
    { name: "Room", description: "Room-based features" },
  ],
});

// Scalar API reference endpoint
app.get(
  "/docs",
  Scalar({
    pageTitle: "SpotiGuess API Documentation",
    sources: [
      { url: "/api/doc", title: "API" },
      { url: "/api/auth/open-api/generate-schema", title: "Auth" },
    ],
  }),
);

// WebSocket endpoint - supports room-based connections
app.get("/ws/:room?", async (c) => {
  const upgradeHeader = c.req.header("upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected Upgrade: websocket", 426);
  }

  // Get room from URL parameter or default to "general"
  const room = c.req.param("room") || "general";

  // Get the Durable Object - use room name to create isolated chat rooms
  const durableObjectId = c.env.WEBSOCKET_HIBERNATION_SERVER.idFromName(`chat-room-${room}`);
  const durableObject = c.env.WEBSOCKET_HIBERNATION_SERVER.get(durableObjectId);

  // Forward the WebSocket upgrade request to the Durable Object
  return durableObject.fetch(c.req.raw);
});

// Serve the React SPA for all other routes (client-side routing)
app.get("*", async (c) => {
  const assets = c.env as unknown as { ASSETS: Fetcher };
  return assets.ASSETS.fetch(c.req.raw);
});

export default app;
