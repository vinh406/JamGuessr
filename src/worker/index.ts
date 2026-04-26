import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { cors } from "hono/cors";
import { auth } from "./lib/better-auth";
import {
  getCurrentUserPlaylists,
  getPlaylistMetadata,
  parseSpotifyPlaylistLink,
} from "./lib/spotify/playlists";
export { WebSocketHibernationServer } from "./websocketDurableObject";

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
const RootResponseSchema = z
  .object({
    name: z.string().openapi({ description: "API name", example: "SpotiGuess API" }),
  })
  .openapi("RootResponse");

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

const ImportPlaylistRequestSchema = z
  .object({
    link: z.string().min(1).openapi({
      description: "Spotify playlist URL or URI",
      example: "https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M",
    }),
  })
  .openapi("ImportPlaylistRequest");

const PlaylistMetadataSchema = z
  .object({
    id: z
      .string()
      .openapi({ description: "Spotify playlist ID", example: "37i9dQZF1DXcBWIGoYBM5M" }),
    name: z.string().openapi({ description: "Playlist name", example: "Today's Top Hits" }),
    description: z.string().optional().openapi({ description: "Playlist description" }),
    imageUrl: z.string().optional().openapi({ description: "Playlist cover image URL" }),
    trackCount: z.number().optional().openapi({ description: "Total number of tracks" }),
    ownerId: z.string().optional().openapi({ description: "Playlist owner ID" }),
    spotifyUrl: z.string().optional().openapi({ description: "Spotify URL for the playlist" }),
    tracks: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          artists: z.array(z.string()),
          durationMs: z.number(),
        }),
      )
      .optional()
      .openapi({ description: "Playlist tracks (limited preview)" }),
  })
  .openapi("PlaylistMetadata");

const ImportPlaylistResponseSchema = z
  .object({
    playlist: PlaylistMetadataSchema,
  })
  .openapi("ImportPlaylistResponse");

const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ description: "Error message", example: "Invalid playlist link" }),
  })
  .openapi("ErrorResponse");

// Root endpoint
const rootRoute = createRoute({
  method: "get",
  path: "/api/",
  responses: {
    200: {
      content: { "application/json": { schema: RootResponseSchema } },
      description: "Service information",
    },
  },
  tags: ["Health"],
  summary: "API root",
  description: "Returns basic service information including the API name",
});
app.openapi(rootRoute, (c) => c.json({ name: "SpotiGuess API" }));

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

// Import playlist endpoint
const importPlaylistRoute = createRoute({
  method: "post",
  path: "/api/playlists/import",
  request: {
    body: {
      content: {
        "application/json": {
          schema: ImportPlaylistRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: { "application/json": { schema: ImportPlaylistResponseSchema } },
      description: "Playlist imported successfully",
    },
    400: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Invalid request - missing or invalid playlist link",
    },
    404: {
      content: { "application/json": { schema: ErrorResponseSchema } },
      description: "Playlist not found or access denied",
    },
  },
  tags: ["Playlists"],
  summary: "Import playlist",
  description: "Import a Spotify playlist by URL to get its metadata",
});
app.openapi(importPlaylistRoute, async (c) => {
  const { link } = c.req.valid("json");

  const playlistId = parseSpotifyPlaylistLink(link);

  if (!playlistId) {
    return c.json({ error: "Invalid Spotify playlist link" }, 400);
  }

  const playlist = await getPlaylistMetadata(playlistId);

  if (!playlist) {
    return c.json({ error: "Playlist not found or access denied" }, 404);
  }

  return c.json({ playlist }, 200);
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
