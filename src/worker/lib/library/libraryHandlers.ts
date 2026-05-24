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
    playlistId: z.string().optional().openapi({ description: "Playlist ID if source is a playlist" }),
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
    durationMs: z.number().optional().openapi({ description: "Duration in milliseconds" }),
    addedAt: z.string().openapi({
      description: "ISO timestamp when track was added",
      example: "2024-01-15T10:30:00Z",
    }),
    sources: z.array(TrackSourceSchema).openapi({ description: "Sources that contributed this track" }),
  })
  .openapi("Track");

// Playlist response schema
const PlaylistSchema = z
  .object({
    id: z.string().openapi({
      description: "Library playlist ID",
      example: "123e4567-e89b-12d3-a456-426614174001",
    }),
    spotifyId: z
      .string()
      .openapi({ description: "Spotify playlist ID", example: "37i9dQZF1DXcBWIGoYBM5M" }),
    name: z.string().openapi({ description: "Playlist name", example: "My Favorites" }),
    description: z.string().optional().openapi({ description: "Playlist description" }),
    imageUrl: z.string().optional().openapi({ description: "Playlist cover image URL" }),
    trackCount: z.number().openapi({ description: "Number of tracks in playlist", example: 50 }),
    spotifyUrl: z.string().optional().openapi({ description: "Spotify URL" }),
    addedAt: z.string().openapi({
      description: "ISO timestamp when playlist was added",
      example: "2024-01-15T10:30:00Z",
    }),
  })
  .openapi("Playlist");

// Album response schema
const AlbumSchema = z
  .object({
    id: z.string().openapi({
      description: "Library album ID",
      example: "123e4567-e89b-12d3-a456-426614174002",
    }),
    spotifyId: z
      .string()
      .openapi({ description: "Spotify album ID", example: "4wsqlZ0IqKcJ1EOHhKHSgD" }),
    name: z.string().openapi({ description: "Album name", example: "Midnights" }),
    artists: z.array(ArtistSchema).openapi({ description: "List of artists" }),
    imageUrl: z.string().optional().openapi({ description: "Album cover image URL" }),
    releaseDate: z
      .string()
      .optional()
      .openapi({ description: "Album release date", example: "2022-10-21" }),
    trackCount: z.number().openapi({ description: "Number of tracks in album", example: 13 }),
    spotifyUrl: z.string().optional().openapi({ description: "Spotify URL" }),
    addedAt: z.string().openapi({
      description: "ISO timestamp when album was added",
      example: "2024-01-15T10:30:00Z",
    }),
  })
  .openapi("Album");

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

// User library response schema
const UserLibraryResponseSchema = z
  .object({
    tracks: z.array(TrackSchema).openapi({ description: "User's saved tracks" }),
    playlists: z.array(PlaylistSchema).openapi({ description: "User's imported playlists" }),
    albums: z.array(AlbumSchema).openapi({ description: "User's imported albums" }),
  })
  .openapi("UserLibraryResponse");

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

// Get track response schema
const GetTrackResponseSchema = z
  .object({
    track: TrackSchema,
  })
  .openapi("GetTrackResponse");

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

const PlaylistIdParamSchema = z.object({
  playlistId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "playlistId", in: "path" },
      description: "Unique identifier for the playlist",
      example: "123e4567-e89b-12d3-a456-426614174001",
    }),
});

const AlbumIdParamSchema = z.object({
  albumId: z
    .string()
    .uuid()
    .openapi({
      param: { name: "albumId", in: "path" },
      description: "Unique identifier for the album",
      example: "123e4567-e89b-12d3-a456-426614174002",
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

  // GET /user - Get current user's library (mounted under /api/library)
  const getUserLibraryRoute = createRoute({
    method: "get",
    path: "/user",
    responses: {
      200: {
        content: { "application/json": { schema: UserLibraryResponseSchema } },
        description: "User library data with tracks, playlists, and albums",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
    },
    tags: ["Library"],
    summary: "Get user library",
    description: "Retrieve all tracks, playlists, and albums in the authenticated user's library",
  });
  app.openapi(getUserLibraryRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const lib = createLibraryService(c.env.DATABASE_URL);

    const [tracksWithSources, playlists, albums] = await Promise.all([
      lib.getUserLibrary(user.id),
      lib.getUserPlaylists(user.id),
      lib.getUserAlbums(user.id),
    ]);

    // Transform tracks to API shape
    const tracks = tracksWithSources.map((tws) => {
      const track = tws.track;
      return {
        id: track.id,
        spotifyId: track.spotifyId,
        name: track.name,
        artists: track.artists,
        albumName: track.albumName ?? undefined,
        albumId: track.albumId ?? undefined,
        durationMs: track.durationMs ?? undefined,
        addedAt: track.addedAt instanceof Date ? track.addedAt.toISOString() : track.addedAt,
        sources: tws.sources.map((s) => ({
          type: s.sourceType as "playlist" | "album" | "direct",
          playlistId: s.playlistId ?? undefined,
          albumId: s.albumId ?? undefined,
        })),
      };
    });

    // Transform playlists to API shape
    const playlistsApi = playlists.map((p) => ({
      id: p.id,
      spotifyId: p.spotifyId,
      name: p.name,
      description: undefined,
      imageUrl: p.imageUrl ?? undefined,
      trackCount: p.trackCount,
      spotifyUrl: undefined,
      addedAt: p.addedAt instanceof Date ? p.addedAt.toISOString() : p.addedAt,
    }));

    // Transform albums to API shape
    const albumsApi = albums.map((a) => ({
      id: a.id,
      spotifyId: a.spotifyId,
      name: a.name,
      artists: [{ name: a.artistName }],
      imageUrl: a.imageUrl ?? undefined,
      releaseDate: a.releaseDate ?? undefined,
      trackCount: a.totalTracks,
      spotifyUrl: undefined,
      addedAt: a.addedAt instanceof Date ? a.addedAt.toISOString() : a.addedAt,
    }));

    return c.json({ tracks, playlists: playlistsApi, albums: albumsApi }, 200);
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

    const lib = createLibraryService(c.env.DATABASE_URL);

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
    const lib = createLibraryService(c.env.DATABASE_URL);

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

  // GET /track/:trackId - Get a specific track
  const getTrackRoute = createRoute({
    method: "get",
    path: "/track/{trackId}",
    request: {
      params: TrackIdParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: GetTrackResponseSchema } },
        description: "Track details",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Track not found",
      },
    },
    tags: ["Library"],
    summary: "Get track by ID",
    description: "Retrieve details of a specific track from the user's library",
  });
  app.openapi(getTrackRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const trackId = c.req.param("trackId");
    const lib = createLibraryService(c.env.DATABASE_URL);
    const track = await lib.getTrackById(trackId);

    if (!track || track.userId !== user.id) {
      return c.json({ error: "Track not found" }, 404);
    }

    return c.json(
      {
        track: {
          ...track,
          albumId: track.albumId ?? undefined,
          addedAt: track.addedAt.toISOString(),
          sources: [],
        },
      },
      200,
    );
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

    const lib = createLibraryService(c.env.DATABASE_URL);

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
        await lib.removePlaylist(user.id, parsed.data.id, (phase) => {
          if (phase === "cleaning_up") {
            emit("phase", { phase: "cleaning_up", label: "Cleaning up orphaned tracks..." });
          }
        });
      } else {
        await lib.removeAlbum(user.id, parsed.data.id, (phase) => {
          if (phase === "cleaning_up") {
            emit("phase", { phase: "cleaning_up", label: "Cleaning up orphaned tracks..." });
          }
        });
      }

      if (signal.aborted) return;

      emit("phase", { phase: "updating_stats", label: "Finalizing..." });
      await lib.updateUserLibraryStats(user.id);

      return { success: true, type: parsed.data.type, id: parsed.data.id };
    });
  });

  // DELETE /playlist/:playlistId - Remove playlist and all its tracks
  const deletePlaylistRoute = createRoute({
    method: "delete",
    path: "/playlist/{playlistId}",
    request: {
      params: PlaylistIdParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: SuccessResponseSchema } },
        description: "Playlist removed successfully",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Playlist not found",
      },
    },
    tags: ["Library"],
    summary: "Remove playlist",
    description: "Remove a playlist and all its tracks from the authenticated user's library",
  });
  app.openapi(deletePlaylistRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const playlistId = c.req.param("playlistId");
    const lib = createLibraryService(c.env.DATABASE_URL);

    // Verify playlist exists and belongs to user
    const playlist = await lib.getPlaylistById(playlistId);
    if (!playlist || playlist.userId !== user.id) {
      return c.json({ error: "Playlist not found" }, 404);
    }

    await lib.removePlaylist(user.id, playlistId);
    await lib.updateUserLibraryStats(user.id);

    return c.json({ success: true }, 200);
  });

  // DELETE /album/:albumId - Remove album and all its tracks
  const deleteAlbumRoute = createRoute({
    method: "delete",
    path: "/album/{albumId}",
    request: {
      params: AlbumIdParamSchema,
    },
    responses: {
      200: {
        content: { "application/json": { schema: SuccessResponseSchema } },
        description: "Album removed successfully",
      },
      401: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Unauthorized - authentication required",
      },
      404: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Album not found",
      },
    },
    tags: ["Library"],
    summary: "Remove album",
    description: "Remove an album and all its tracks from the authenticated user's library",
  });
  app.openapi(deleteAlbumRoute, async (c) => {
    const user = await getAuthenticatedUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const albumId = c.req.param("albumId");
    const lib = createLibraryService(c.env.DATABASE_URL);

    // Verify album exists and belongs to user
    const album = await lib.getAlbumById(albumId);
    if (!album || album.userId !== user.id) {
      return c.json({ error: "Album not found" }, 404);
    }

    await lib.removeAlbum(user.id, albumId);
    await lib.updateUserLibraryStats(user.id);

    return c.json({ success: true }, 200);
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

    const lib = createLibraryService(c.env.DATABASE_URL);
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

  // GET /blend - Get blended playlist for a room (Phase 3 - stubbed)
  const getBlendRoute = createRoute({
    method: "get",
    path: "/blend",
    responses: {
      501: {
        content: { "application/json": { schema: ErrorResponseSchema } },
        description: "Not implemented",
      },
    },
    tags: ["Room"],
    summary: "Get blended playlist",
    description:
      "Generate a blended playlist combining all room members' libraries (not yet implemented)",
  });
  app.openapi(getBlendRoute, async (c) => {
    return c.json({ error: "Room blend not yet implemented" }, 501);
  });

  return app;
}

export const libraryHandlers = createLibraryHandlers();
