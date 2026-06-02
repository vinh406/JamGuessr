import { OpenAPIHono, createRoute, z } from "@hono/zod-openapi";
import { auth } from "../better-auth";
import { createLibraryService } from "./LibraryService";
import { sseStream } from "../sse";
import { parseSpotifyLink } from "../spotify/playlists";

// OpenAPI Schema Definitions

// Artist schema for nested use
const ArtistSchema = z
  .object({
    name: z.string().openapi({ description: "Artist name", example: "Taylor Swift" }),
    id: z.string().optional().openapi({ description: "Spotify artist ID" }),
  })
  .openapi("Artist");

// Track source entry schema
const TrackSourceSchema = z
  .object({
    type: z.enum(["direct", "playlist", "album"]).openapi({ description: "Source type" }),
    playlistId: z
      .string()
      .optional()
      .openapi({ description: "Playlist ID if source is a playlist" }),
    albumId: z.string().optional().openapi({ description: "Album ID if source is an album" }),
  })
  .openapi("TrackSource");

// Track response schema
const TrackSchema = z
  .object({
    id: z.string().openapi({
      description: "Library track ID",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
    spotifyId: z
      .string()
      .openapi({ description: "Spotify track ID", example: "4cOdK2wGLETKBW3PvgRsqC" }),
    name: z.string().openapi({ description: "Track name", example: "Anti-Hero" }),
    artists: z.array(ArtistSchema).openapi({ description: "List of artists" }),
    albumName: z.string().optional().openapi({ description: "Album name" }),
    albumId: z.string().optional().openapi({ description: "Spotify album ID" }),
    albumImageUrl: z.string().optional().openapi({ description: "Album cover image URL" }),
    durationMs: z.number().optional().openapi({ description: "Duration in milliseconds" }),
    addedAt: z.string().openapi({
      description: "ISO timestamp when track was added",
      example: "2024-01-15T10:30:00Z",
    }),
    sources: z
      .array(TrackSourceSchema)
      .openapi({ description: "Sources that contributed this track" }),
  })
  .openapi("Track");

// Library stats schema
const LibraryStatsSchema = z
  .object({
    totalSongs: z.number().openapi({ description: "Total number of tracks", example: 150 }),
    totalPlaylists: z.number().openapi({ description: "Total number of playlists", example: 5 }),
    totalAlbums: z.number().openapi({ description: "Total number of albums", example: 10 }),
    lastUpdated: z.string().openapi({
      description: "ISO timestamp of last stats update",
      example: "2024-01-15T10:30:00Z",
    }),
  })
  .openapi("LibraryStats");

// Library item response schema
const LibraryItemSchema = z
  .object({
    type: z.enum(["playlist", "album", "tracks"]).openapi({ description: "Item type" }),
    id: z.string().openapi({ description: "Item ID" }),
    spotifyId: z.string().optional().openapi({ description: "Spotify ID" }),
    name: z.string().openapi({ description: "Item name" }),
    artists: z.array(ArtistSchema).optional().openapi({ description: "Artists (album only)" }),
    imageUrl: z.string().optional().openapi({ description: "Cover image URL" }),
    trackCount: z.number().openapi({ description: "Number of tracks" }),
    addedAt: z.string().openapi({ description: "ISO timestamp" }),
  })
  .openapi("LibraryItem");

const LibraryItemsResponseSchema = z
  .object({
    items: z.array(LibraryItemSchema).openapi({ description: "Paginated library items" }),
    nextCursor: z.string().nullable().openapi({ description: "Cursor for next page" }),
  })
  .openapi("LibraryItemsResponse");

const LibraryTracksResponseSchema = z
  .object({
    tracks: z
      .array(TrackSchema.omit({ sources: true }))
      .openapi({ description: "Paginated tracks" }),
    nextCursor: z.string().nullable().openapi({ description: "Cursor for next page" }),
  })
  .openapi("LibraryTracksResponse");

const QueryCursorSchema = z.object({
  cursor: z
    .string()
    .optional()
    .openapi({
      param: { name: "cursor", in: "query" },
      description: "Cursor for pagination",
    }),
  limit: z.coerce
    .number()
    .optional()
    .default(20)
    .openapi({
      param: { name: "limit", in: "query" },
      description: "Items per page",
    }),
});

// Add from Spotify link request schema
const AddFromLinkRequestSchema = z
  .object({
    link: z.string().min(1).openapi({
      description: "Any Spotify URL (track, playlist, or album)",
      example: "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgRsqC",
    }),
  })
  .openapi("AddFromLinkRequest");

// Remove request schema
const RemoveRequestSchema = z
  .object({
    type: z.enum(["playlist", "album"]).openapi({
      description: "Type of content to remove",
      example: "playlist",
    }),
    id: z.string().uuid().openapi({
      description: "ID of the playlist or album to remove",
      example: "123e4567-e89b-12d3-a456-426614174001",
    }),
  })
  .openapi("RemoveRequest");

// Get stats response schema
const GetStatsResponseSchema = LibraryStatsSchema;

// Success response schema
const SuccessResponseSchema = z
  .object({
    success: z.boolean().openapi({ description: "Whether the operation succeeded", example: true }),
  })
  .openapi("SuccessResponse");

// Error response schema
const ErrorResponseSchema = z
  .object({
    error: z.string().openapi({ description: "Error message", example: "Track not found" }),
  })
  .openapi("ErrorResponse");

// Path parameter schemas
const TrackIdParamSchema = z.object({
  trackId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "trackId", in: "path" },
      description: "Unique identifier for the track",
      example: "123e4567-e89b-12d3-a456-426614174000",
    }),
});

export function createLibraryHandlers() {
  const app = new OpenAPIHono<{ Bindings: Env }>();

  // Helper to get authenticated user
  const getAuthenticatedUser = async (c: { env: Env; req: { raw: Request } }) => {
    const authInstance = auth(c.env);
    const session = await authInstance.api.getSession(c.req.raw);
    return session?.user;
  };

  // GET /items - Get paginated top-level library items
  const getItemsRoute = createRoute({
    method: "get",
    path: "/items",
    request: { query: QueryCursorSchema },
    responses: {
      200: {
        content: { "application/json": { schema: LibraryItemsResponseSchema } },
        description: "Paginated library items (playlists, albums, and tracks container)",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["Library"],
    summary: "Get library items",
    description: "Paginated feed of top-level library items sorted by added date",
  });
  app.openapi(getItemsRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { cursor, limit } = c.req.valid("query");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const result = await lib.getItems(user.id, cursor, limit);
    return c.json(result, 200);
  });

  // GET /items/tracks - Get paginated direct tracks
  const getDirectTracksRoute = createRoute({
    method: "get",
    path: "/items/tracks",
    request: {
      query: QueryCursorSchema.extend({
        limit: z.coerce.number().optional().default(50),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: LibraryTracksResponseSchema } },
        description: "Paginated directly-added tracks",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["Library"],
    summary: "Get direct tracks",
    description: "Paginated list of tracks added directly (not from a playlist or album)",
  });
  app.openapi(getDirectTracksRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { cursor, limit } = c.req.valid("query");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const result = await lib.getDirectTracks(user.id, cursor, limit);
    return c.json(result, 200);
  });

  // GET /items/playlist/:spotifyId/tracks - Get paginated playlist tracks
  const getPlaylistTracksRoute = createRoute({
    method: "get",
    path: "/items/playlist/{spotifyId}/tracks",
    request: {
      params: z.object({
        spotifyId: z.string().openapi({
          param: { name: "spotifyId", in: "path" },
          description: "Spotify playlist ID",
        }),
      }),
      query: QueryCursorSchema.extend({
        limit: z.coerce.number().optional().default(50),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: LibraryTracksResponseSchema } },
        description: "Paginated playlist tracks",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["Library"],
    summary: "Get playlist tracks",
    description: "Paginated list of tracks for a specific playlist",
  });
  app.openapi(getPlaylistTracksRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { spotifyId } = c.req.valid("param");
    const { cursor, limit } = c.req.valid("query");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const result = await lib.getPlaylistTracksPaginated(user.id, spotifyId, cursor, limit);
    return c.json(result, 200);
  });

  // GET /items/album/:spotifyId/tracks - Get paginated album tracks
  const getAlbumTracksRoute = createRoute({
    method: "get",
    path: "/items/album/{spotifyId}/tracks",
    request: {
      params: z.object({
        spotifyId: z
          .string()
          .openapi({ param: { name: "spotifyId", in: "path" }, description: "Spotify album ID" }),
      }),
      query: QueryCursorSchema.extend({
        limit: z.coerce.number().optional().default(50),
      }),
    },
    responses: {
      200: {
        content: { "application/json": { schema: LibraryTracksResponseSchema } },
        description: "Paginated album tracks",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized",
      },
    },
    tags: ["Library"],
    summary: "Get album tracks",
    description: "Paginated list of tracks for a specific album",
  });
  app.openapi(getAlbumTracksRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { spotifyId } = c.req.valid("param");
    const { cursor, limit } = c.req.valid("query");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const result = await lib.getAlbumTracksPaginated(user.id, spotifyId, cursor, limit);
    return c.json(result, 200);
  });

  app.get("/playlist/:spotifyId", async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }
    const spotifyId = c.req.param("spotifyId");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const playlists = await lib.getUserPlaylists(user.id);
    const match = playlists.find((p) => p.spotifyId === spotifyId);
    if (match) {
      return c.json({
        inLibrary: true,
        playlist: {
          name: match.name,
          imageUrl: match.imageUrl ?? undefined,
          trackCount: match.trackCount,
        },
      });
    }
    return c.json({ inLibrary: false });
  });

  // POST /add - Add any Spotify content (track, playlist, or album) from a URL
  const addFromLinkRoute = createRoute({
    method: "post",
    path: "/add",
    request: {
      body: {
        content: {
          "application/json": {
            schema: AddFromLinkRequestSchema,
          },
        },
      },
    },
    responses: {
      200: {
        description: "SSE stream with progress and result events",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Invalid Spotify link or failed to fetch metadata",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
    },
    tags: ["Library"],
    summary: "Add from Spotify link",
    description:
      "Add a track, playlist, or album to the user's library. Paste any Spotify URL — the type is auto-detected.",
  });
  app.openapi(addFromLinkRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = AddFromLinkRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request — must provide a 'link' field" }, 400);
    }

    return sseStream(async (emit, signal) => {
      const parsedLink = parseSpotifyLink(parsed.data.link);
      if (!parsedLink) {
        emit("error", { message: "Could not parse Spotify link" });
        return;
      }

      if (parsedLink.type === "track") {
        emit("phase", { phase: "fetching", label: "Fetching track metadata..." });
      } else if (parsedLink.type === "playlist") {
        emit("phase", { phase: "fetching", label: "Fetching playlist tracks from Spotify..." });
      } else {
        emit("phase", { phase: "fetching", label: "Fetching album tracks from Spotify..." });
      }

      if (signal.aborted) return;

      const lib = createLibraryService(c.env.DATABASE_URL, c.env);

      const result = await lib.addFromSpotifyLink(user.id, parsed.data.link, (current, total) => {
        emit("progress", {
          current,
          total,
          phase: "saving",
          label: `Saving track ${current} of ${total}...`,
        });
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      return {
        success: true,
        type: result.type,
        id: result.id,
        trackCount: result.trackCount,
      };
    });
  });

  // DELETE /track/:trackId - Remove track from library
  const deleteTrackRoute = createRoute({
    method: "delete",
    path: "/track/{trackId}",
    request: {
      params: TrackIdParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: SuccessResponseSchema } },
        description: "Track removed successfully",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Track not found",
      },
      500: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Internal server error",
      },
    },
    tags: ["Library"],
    summary: "Remove track",
    description: "Remove a track from the authenticated user's library",
  });
  app.openapi(deleteTrackRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const trackId = c.req.param("trackId");
    const lib = createLibraryService(c.env.DATABASE_URL, c.env);

    // Verify track exists and belongs to user
    const track = await lib.getTrackById(trackId);
    if (!track || track.userId !== user.id) {
      return c.json({ error: "Track not found" }, 404);
    }

    const result = await lib.removeTrackFromLibrary(user.id, trackId);

    if (!result.success) {
      return c.json({ error: result.error ?? "Unknown error" }, 500);
    }

    return c.json({ success: true }, 200);
  });

  // POST /remove - Remove playlist or album with SSE progress
  const removeRoute = createRoute({
    method: "post",
    path: "/remove",
    request: {
      body: {
        content: { "application/json": { schema: RemoveRequestSchema } },
      },
    },
    responses: {
      200: {
        description: "SSE stream with progress and result events",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Invalid request body",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Playlist or album not found",
      },
    },
    tags: ["Library"],
    summary: "Remove playlist or album",
    description:
      "Remove a playlist or album and all its tracks from the user's library with progress feedback",
  });
  app.openapi(removeRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = await c.req.json().catch(() => ({}));
    const parsed = RemoveRequestSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: "Invalid request" }, 400);
    }

    const lib = createLibraryService(c.env.DATABASE_URL, c.env);

    // Verify ownership before starting SSE
    if (parsed.data.type === "playlist") {
      const playlist = await lib.getPlaylistById(parsed.data.id);
      if (!playlist || playlist.userId !== user.id) {
        return c.json({ error: "Playlist not found" }, 404);
      }
    } else {
      const album = await lib.getAlbumById(parsed.data.id);
      if (!album || album.userId !== user.id) {
        return c.json({ error: "Album not found" }, 404);
      }
    }

    return sseStream(async (emit, signal) => {
      emit("phase", { phase: "removing", label: "Removing from your library..." });

      if (signal.aborted) return;

      if (parsed.data.type === "playlist") {
        await lib.removePlaylist(user.id, parsed.data.id);
      } else {
        await lib.removeAlbum(user.id, parsed.data.id);
      }

      if (signal.aborted) return;

      emit("phase", { phase: "updating_stats", label: "Finalizing..." });
      await lib.updateUserLibraryStats(user.id);

      return { success: true, type: parsed.data.type, id: parsed.data.id };
    });
  });

  // GET /stats - Get current user's library stats
  const getStatsRoute = createRoute({
    method: "get",
    path: "/stats",
    responses: {
      200: {
        content: { "application/json": { schema: GetStatsResponseSchema } },
        description: "Library statistics including total songs, playlists, and albums",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
    },
    tags: ["Library"],
    summary: "Get library stats",
    description:
      "Retrieve statistics about the user's library including total songs, playlists, and albums",
  });
  app.openapi(getStatsRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const stats = await lib.getUserLibraryStats(user.id);

    return c.json(
      stats
        ? {
            totalSongs: stats.totalSongs,
            totalPlaylists: stats.totalPlaylists,
            totalAlbums: stats.totalAlbums,
            lastUpdated: stats.lastUpdated.toISOString(),
          }
        : {
            totalSongs: 0,
            totalPlaylists: 0,
            totalAlbums: 0,
            lastUpdated: new Date().toISOString(),
          },
      200,
    );
  });

  // Song schema for blend response
  const SongSchema = z
    .object({
      id: z.string().openapi({ description: "Spotify track ID", example: "4cOdK2wGLETKBW3PvgRsqC" }),
      title: z.string().openapi({ description: "Song title", example: "Anti-Hero" }),
      artist: z.string().openapi({ description: "Artist name(s)", example: "Taylor Swift" }),
      album: z.string().openapi({ description: "Album name", example: "Midnights" }),
      albumImageUrl: z.string().optional().openapi({ description: "Album cover URL" }),
      previewUrl: z.string().optional().openapi({ description: "Spotify preview URL" }),
      duration: z.number().openapi({ description: "Duration in milliseconds", example: 200000 }),
    })
    .openapi("Song");

  // Blend query schema
  const BlendQuerySchema = z.object({
    userIds: z
      .string()
      .openapi({
        param: { name: "userIds", in: "query" },
        description: "Comma-separated list of user IDs to blend",
        example: "user1,user2,user3",
      }),
    targetTrackCount: z.coerce
      .number()
      .optional()
      .default(30)
      .openapi({
        param: { name: "targetTrackCount", in: "query" },
        description: "Target number of tracks in the blended playlist (default: 30)",
      }),
    minTracksPerUser: z.coerce
      .number()
      .optional()
      .openapi({
        param: { name: "minTracksPerUser", in: "query" },
        description: "Minimum tracks per user before emitting a warning",
      }),
  });

  const BlendResponseSchema = z
    .object({
      songs: z.array(SongSchema).openapi({ description: "Blended playlist songs" }),
      warnings: z.array(z.string()).openapi({ description: "Non-blocking warnings" }),
    })
    .openapi("BlendResponse");

  // GET /blend - Get blended playlist from multiple users' libraries
  const getBlendRoute = createRoute({
    method: "get",
    path: "/blend",
    request: { query: BlendQuerySchema },
    responses: {
      200: {
        content: { "application/json": { schema: BlendResponseSchema } },
        description: "Blended playlist combining all specified users' libraries",
      },
      400: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Bad request — must provide at least one userId",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
    },
    tags: ["Room"],
    summary: "Get blended playlist",
    description:
      "Generate a blended playlist combining multiple users' libraries. Provide comma-separated userIds.",
  });
  app.openapi(getBlendRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const query = c.req.valid("query");
    const userIds = query.userIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    if (userIds.length === 0) {
      return c.json({ error: "At least one userId is required" }, 400);
    }

    const lib = createLibraryService(c.env.DATABASE_URL, c.env);
    const result = await lib.getRoomBlendedPlaylist(userIds, query.targetTrackCount, {
      minTracksPerUser: query.minTracksPerUser,
    });
    return c.json(result, 200);
  });

  return app;
}

export const libraryHandlers = createLibraryHandlers();
