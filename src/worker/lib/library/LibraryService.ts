import { eq, and, inArray, count, notExists } from "drizzle-orm";
import { getDb, type DbInstance } from "../../db";
import type { Song } from "../../../shared/types";
import {
  parseSpotifyLink,
  getTrackMetadata,
  getPlaylistMetadata,
  getPlaylistTracks,
  getAlbumMetadata,
  getAlbumTracks,
  type SpotifyLinkType,
} from "../spotify/playlists";
import {
  libraryTracks,
  libraryTrackSources,
  libraryPlaylists,
  libraryAlbums,
  userLibraryStats,
} from "../../db/schema";

// ── Types ────────────────────────────────────────────────────────────────────

type LibraryTrack = typeof libraryTracks.$inferSelect;
type LibraryTrackSource = typeof libraryTrackSources.$inferSelect;
type PlaylistRecord = typeof libraryPlaylists.$inferSelect;
type AlbumRecord = typeof libraryAlbums.$inferSelect;
type LibraryTrackRecord = typeof libraryTracks.$inferSelect;
type LibraryStatsRecord = typeof userLibraryStats.$inferSelect;

export interface TrackData {
  id: string;
  spotifyId: string;
  name: string;
  artists: { name: string; id?: string }[];
  albumName?: string;
  albumId?: string;
  albumImageUrl?: string;
  durationMs?: number;
}

export interface TrackWithSources {
  track: LibraryTrack;
  sources: LibraryTrackSource[];
}

export interface LibraryStats {
  totalSongs: number;
  totalPlaylists: number;
  totalAlbums: number;
  lastUpdated: Date;
}

export interface UserLibraryResponse {
  tracks: {
    id: string;
    spotifyId: string;
    name: string;
    artist: string;
    album: string;
    duration: number;
    addedAt: Date;
    sources: {
      type: string;
      playlistId?: string;
      albumId?: string;
    }[];
  }[];
  playlists: {
    id: string;
    name: string;
    imageUrl: string | null;
    trackCount: number;
    addedAt: Date;
  }[];
  albums: {
    id: string;
    name: string;
    artistName: string;
    imageUrl: string | null;
    totalTracks: number;
    addedAt: Date;
  }[];
  stats: LibraryStats;
}

export interface BlendResult {
  songs: Song[];
  warnings: string[];
}

const MIN_TOTAL_TRACKS = 20;

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a LibraryService bound to a single request.
 *
 * Call this once per request with the connection string; the returned
 * object exposes all library operations without needing a `db` parameter.
 */
export function createLibraryService(connectionString: string) {
  let _db: DbInstance | null = null;
  function db(): DbInstance {
    if (!_db) _db = getDb(connectionString);
    return _db;
  }
  const BATCH_SIZE = 25;

  // ── Internal query helpers (not exported) ──────────────────────────────

  async function trackExistsBySpotifyId(
    userId: string,
    spotifyId: string,
  ): Promise<LibraryTrack | undefined> {
    return db().query.libraryTracks.findFirst({
      where: and(eq(libraryTracks.userId, userId), eq(libraryTracks.spotifyId, spotifyId)),
    });
  }

  async function batchInsertTracks(
    userId: string,
    tracks: TrackData[],
    sourceType: "playlist" | "album",
    containerId: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<{ track: LibraryTrack; source: LibraryTrackSource }[]> {
    if (tracks.length === 0) return [];

    const allSpotifyIds = tracks.map((t) => t.spotifyId);

    const existingTracks = await db()
      .select()
      .from(libraryTracks)
      .where(
        and(eq(libraryTracks.userId, userId), inArray(libraryTracks.spotifyId, allSpotifyIds)),
      );

    const existingBySpotifyId = new Map(existingTracks.map((t) => [t.spotifyId, t]));
    const results: { track: LibraryTrack; source: LibraryTrackSource }[] = [];

    for (let i = 0; i < tracks.length; i += BATCH_SIZE) {
      const chunk = tracks.slice(i, i + BATCH_SIZE);

      const newTracksData = chunk
        .filter((t) => !existingBySpotifyId.has(t.spotifyId))
        .map((t) => ({
          id: t.id,
          userId,
          spotifyId: t.spotifyId,
          name: t.name,
          artists: t.artists,
          albumName: t.albumName || "",
          albumId: t.albumId,
          durationMs: t.durationMs || 0,
        }));

      const insertedTracks: LibraryTrack[] = [];
      if (newTracksData.length > 0) {
        insertedTracks.push(
          ...(await db().insert(libraryTracks).values(newTracksData).onConflictDoNothing().returning()),
        );
      }

      const sourceValues = chunk.map((trackData) => {
        const existing = existingBySpotifyId.get(trackData.spotifyId);
        return {
          id: crypto.randomUUID(),
          trackId: existing ? existing.id : trackData.id,
          userId,
          sourceType,
          ...(sourceType === "playlist" ? { playlistId: containerId } : { albumId: containerId }),
        };
      });

      const insertedSources: LibraryTrackSource[] = [];
      if (sourceValues.length > 0) {
        insertedSources.push(
          ...(await db().insert(libraryTrackSources).values(sourceValues).returning()),
        );
      }

      const sourceByTrackId = new Map(insertedSources.map((s) => [s.trackId, s]));
      const insertedBySpotifyId = new Map(insertedTracks.map((t) => [t.spotifyId, t]));

      for (const trackData of chunk) {
        const existing = existingBySpotifyId.get(trackData.spotifyId);
        const track = existing ?? insertedBySpotifyId.get(trackData.spotifyId);
        const source = track ? sourceByTrackId.get(track.id) : undefined;
        if (!track || !source) continue;
        results.push({ track, source });
      }

      onProgress?.(i + chunk.length, tracks.length);
    }

    return results;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  return {
    // ── Reads ──────────────────────────────────────────────────────────

    /** Get all tracks in a user's library with their sources */
    async getUserLibrary(userId: string): Promise<TrackWithSources[]> {
      const tracks = await db().query.libraryTracks.findMany({
        where: eq(libraryTracks.userId, userId),
        with: { sources: true },
      });

      return tracks.map((track: LibraryTrack & { sources: LibraryTrackSource[] }) => ({
        track,
        sources: track.sources,
      }));
    },

    /** Get a specific track by ID */
    async getTrackById(trackId: string): Promise<LibraryTrack | undefined> {
      return db().query.libraryTracks.findFirst({
        where: eq(libraryTracks.id, trackId),
      });
    },

    /** Get user's playlists */
    async getUserPlaylists(userId: string): Promise<PlaylistRecord[]> {
      return db().query.libraryPlaylists.findMany({
        where: eq(libraryPlaylists.userId, userId),
      });
    },

    /** Get a playlist by ID */
    async getPlaylistById(playlistId: string): Promise<PlaylistRecord | null> {
      const playlist = await db().query.libraryPlaylists.findFirst({
        where: eq(libraryPlaylists.id, playlistId),
      });
      return playlist ?? null;
    },

    /** Get user's albums */
    async getUserAlbums(userId: string): Promise<AlbumRecord[]> {
      return db().query.libraryAlbums.findMany({
        where: eq(libraryAlbums.userId, userId),
      });
    },

    /** Get an album by ID */
    async getAlbumById(albumId: string): Promise<AlbumRecord | null> {
      const album = await db().query.libraryAlbums.findFirst({
        where: eq(libraryAlbums.id, albumId),
      });
      return album ?? null;
    },

    /** Get user library stats */
    async getUserLibraryStats(userId: string): Promise<LibraryStatsRecord | undefined> {
      return db().query.userLibraryStats.findFirst({
        where: eq(userLibraryStats.userId, userId),
      });
    },

    /** Get tracks for a playlist stored in the user's library, by Spotify playlist ID */
    async getLibraryPlaylistTracks(
      userId: string,
      spotifyId: string,
    ): Promise<Song[]> {
      const playlist = await db().query.libraryPlaylists.findFirst({
        where: and(
          eq(libraryPlaylists.userId, userId),
          eq(libraryPlaylists.spotifyId, spotifyId),
        ),
      });
      if (!playlist) return [];

      const sources = await db().query.libraryTrackSources.findMany({
        where: and(
          eq(libraryTrackSources.userId, userId),
          eq(libraryTrackSources.playlistId, playlist.id),
          eq(libraryTrackSources.sourceType, "playlist"),
        ),
        with: { track: true },
      });

      return sources
        .filter((s) => s.track)
        .map((s) => ({
          id: s.track.spotifyId,
          title: s.track.name,
          artist: s.track.artists.map((a) => a.name).join(", "),
          album: s.track.albumName,
          albumImageUrl: s.track.albumImageUrl ?? undefined,
          previewUrl: undefined,
          duration: s.track.durationMs || 0,
        }));
    },

    /** Get all tracks for multiple users (for blend algorithm) */
    async getTracksForUsers(userIds: string[]): Promise<Map<string, LibraryTrack[]>> {
      const tracks = await db().query.libraryTracks.findMany({
        where: inArray(libraryTracks.userId, userIds),
      });

      const trackMap = new Map<string, LibraryTrack[]>();
      for (const track of tracks) {
        const existing = trackMap.get(track.userId) || [];
        existing.push(track);
        trackMap.set(track.userId, existing);
      }
      return trackMap;
    },

    // ── Writes ─────────────────────────────────────────────────────────

    /** Add a track with a direct source entry */
    async addTrack(
      userId: string,
      trackData: TrackData,
    ): Promise<{ track: LibraryTrack; source: LibraryTrackSource } | { error: string }> {
      const existing = await trackExistsBySpotifyId(userId, trackData.spotifyId);
      if (existing) {
        return { error: "Track already exists in library" };
      }

      const [track] = await db()
        .insert(libraryTracks)
        .values({
          id: trackData.id,
          userId,
          spotifyId: trackData.spotifyId,
          name: trackData.name,
          artists: trackData.artists,
          albumName: trackData.albumName || "",
          albumId: trackData.albumId,
          albumImageUrl: trackData.albumImageUrl,
          durationMs: trackData.durationMs || 0,
        })
        .returning();

      const [source] = await db()
        .insert(libraryTrackSources)
        .values({
          id: crypto.randomUUID(),
          trackId: track!.id,
          userId,
          sourceType: "direct",
        })
        .returning();

      return { track: track!, source: source! };
    },

    /** Convenience: add track + update stats */
    async addTrackToLibrary(
      userId: string,
      trackData: {
        spotifyId: string;
        name: string;
        artists: { name: string; id?: string }[];
        albumName?: string;
        albumId?: string;
        durationMs?: number;
      },
    ): Promise<{ success: true; trackId: string } | { success: false; error: string }> {
      const result = await this.addTrack(userId, {
        id: crypto.randomUUID(),
        ...trackData,
      });

      if ("error" in result) {
        return { success: false, error: result.error };
      }

      await this.updateUserLibraryStats(userId);
      return { success: true, trackId: result.track.id };
    },

    /** Remove a track and all its source entries */
    async removeTrack(userId: string, trackId: string): Promise<void> {
      await db()
        .delete(libraryTrackSources)
        .where(
          and(eq(libraryTrackSources.userId, userId), eq(libraryTrackSources.trackId, trackId)),
        );

      await db()
        .delete(libraryTracks)
        .where(and(eq(libraryTracks.userId, userId), eq(libraryTracks.id, trackId)));
    },

    // ── Unified add from Spotify link ────────────────────────────────

    /**
     * Add any Spotify content (track, playlist, or album) to the user's library.
     * Auto-detects the type from the URL and delegates to the appropriate method.
     */
    async addFromSpotifyLink(
      userId: string,
      link: string,
      onProgress?: (current: number, total: number) => void,
    ): Promise<
      | { success: true; type: SpotifyLinkType; id: string; trackCount?: number }
      | { success: false; error: string }
    > {
      const parsed = parseSpotifyLink(link);
      if (!parsed) {
        return {
          success: false,
          error: "Invalid Spotify link — could not detect track, playlist, or album",
        };
      }

      switch (parsed.type) {
        case "track": {
          const metadata = await getTrackMetadata(parsed.id);
          if (!metadata) {
            return { success: false, error: "Failed to fetch track metadata from Spotify" };
          }

          const result = await this.addTrackToLibrary(userId, {
            spotifyId: metadata.id,
            name: metadata.name,
            artists: [{ name: metadata.artist }],
            albumName: metadata.albumName || undefined,
            durationMs: metadata.durationMs || undefined,
          });

          if (!result.success) return result;
          return { success: true, type: "track", id: result.trackId };
        }

        case "playlist": {
          const [metadata, tracks] = await Promise.all([
            getPlaylistMetadata(parsed.id),
            getPlaylistTracks(parsed.id),
          ]);

          if (!metadata) {
            return { success: false, error: "Failed to fetch playlist metadata from Spotify" };
          }

          // Create the playlist record
          const playlistResult = await this.addPlaylist(userId, {
            id: crypto.randomUUID(),
            spotifyId: parsed.id,
            name: metadata.name,
            imageUrl: metadata.imageUrl,
            trackCount: metadata.trackCount,
          });

          if ("error" in playlistResult) {
            return { success: false, error: playlistResult.error };
          }

          const playlist = playlistResult.playlist;

          // Add all tracks with playlist source
          const trackData = tracks.map((t) => ({
            id: crypto.randomUUID(),
            spotifyId: t.id,
            name: t.title,
            artists: [{ name: t.artist }],
            albumName: t.album || undefined,
            albumImageUrl: t.albumImageUrl || undefined,
            durationMs: t.duration || undefined,
          }));

          await this.addTracksFromPlaylist(userId, playlist.id, trackData, onProgress);
          await this.updateUserLibraryStats(userId);

          return {
            success: true,
            type: "playlist",
            id: playlist.id,
            trackCount: metadata.trackCount,
          };
        }

        case "album": {
          const [metadata, tracks] = await Promise.all([
            getAlbumMetadata(parsed.id),
            getAlbumTracks(parsed.id),
          ]);

          if (!metadata) {
            return { success: false, error: "Failed to fetch album metadata from Spotify" };
          }

          // Create the album record
          const albumResult = await this.addAlbum(userId, {
            id: crypto.randomUUID(),
            spotifyId: parsed.id,
            name: metadata.name,
            artistName: metadata.artistName,
            releaseDate: metadata.releaseDate ?? undefined,
            imageUrl: metadata.imageUrl,
            totalTracks: metadata.totalTracks,
          });

          if ("error" in albumResult) {
            return { success: false, error: albumResult.error };
          }

          const album = albumResult.album;

          // Add all tracks with album source
          const trackData = tracks.map((t) => ({
            id: crypto.randomUUID(),
            spotifyId: t.id,
            name: t.title,
            artists: [{ name: t.artist }],
            albumName: t.album || metadata.name,
            albumId: album.id,
            durationMs: t.duration || undefined,
          }));

          await this.addTracksFromAlbum(userId, album.id, trackData, onProgress);
          await this.updateUserLibraryStats(userId);

          return { success: true, type: "album", id: album.id, trackCount: metadata.totalTracks };
        }
      }
    },

    /** Convenience: remove track + update stats */
    async removeTrackFromLibrary(
      userId: string,
      trackId: string,
    ): Promise<{ success: boolean; error?: string }> {
      try {
        await this.removeTrack(userId, trackId);
        await this.updateUserLibraryStats(userId);
        return { success: true };
      } catch {
        return { success: false, error: "Failed to remove track" };
      }
    },

    /** Remove a specific source entry from a track; delete track if orphaned */
    async removeSourceEntry(userId: string, trackId: string, sourceId: string): Promise<void> {
      await db()
        .delete(libraryTrackSources)
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.trackId, trackId),
            eq(libraryTrackSources.id, sourceId),
          ),
        );

      const remainingSources = await db().query.libraryTrackSources.findFirst({
        where: eq(libraryTrackSources.trackId, trackId),
      });

      if (!remainingSources) {
        await db().delete(libraryTracks).where(eq(libraryTracks.id, trackId));
      }
    },

    /** Add a playlist (rejects if user already has this spotifyId) */
    async addPlaylist(
      userId: string,
      playlistData: {
        id: string;
        spotifyId: string;
        name: string;
        imageUrl?: string;
        trackCount: number;
      },
    ): Promise<{ playlist: PlaylistRecord } | { error: string }> {
      // Check for duplicate
      const existing = await db().query.libraryPlaylists.findFirst({
        where: and(
          eq(libraryPlaylists.userId, userId),
          eq(libraryPlaylists.spotifyId, playlistData.spotifyId),
        ),
      });
      if (existing) {
        return { error: "Playlist already exists in your library" };
      }

      const [playlist] = await db()
        .insert(libraryPlaylists)
        .values({
          id: playlistData.id,
          userId,
          spotifyId: playlistData.spotifyId,
          name: playlistData.name,
          imageUrl: playlistData.imageUrl,
          trackCount: playlistData.trackCount,
        })
        .returning();

      return { playlist: playlist! };
    },

    /** Remove a playlist and cascade-delete orphaned tracks */
    async removePlaylist(
      userId: string,
      playlistId: string,
      onProgress?: (phase: string) => void,
    ): Promise<void> {
      onProgress?.("removing_sources");

      const sourceEntries = await db().query.libraryTrackSources.findMany({
        where: and(
          eq(libraryTrackSources.userId, userId),
          eq(libraryTrackSources.sourceType, "playlist"),
          eq(libraryTrackSources.playlistId, playlistId),
        ),
      });

      const trackIds = sourceEntries.map((s: LibraryTrackSource) => s.trackId);

      await db()
        .delete(libraryTrackSources)
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "playlist"),
            eq(libraryTrackSources.playlistId, playlistId),
          ),
        );

      if (trackIds.length > 0) {
        onProgress?.("cleaning_up");

        const orphanedTracks = await db()
          .select({ id: libraryTracks.id })
          .from(libraryTracks)
          .where(
            and(
              inArray(libraryTracks.id, trackIds),
              notExists(
                db()
                  .select({ id: libraryTrackSources.id })
                  .from(libraryTrackSources)
                  .where(eq(libraryTrackSources.trackId, libraryTracks.id)),
              ),
            ),
          );

        for (const track of orphanedTracks) {
          await db().delete(libraryTracks).where(eq(libraryTracks.id, track.id));
        }
      }

      await db()
        .delete(libraryPlaylists)
        .where(and(eq(libraryPlaylists.userId, userId), eq(libraryPlaylists.id, playlistId)));
    },

    /** Add an album (rejects if user already has this spotifyId) */
    async addAlbum(
      userId: string,
      albumData: {
        id: string;
        spotifyId: string;
        name: string;
        artistName?: string;
        releaseDate?: string;
        imageUrl?: string;
        totalTracks?: number;
      },
    ): Promise<{ album: AlbumRecord } | { error: string }> {
      // Check for duplicate
      const existing = await db().query.libraryAlbums.findFirst({
        where: and(
          eq(libraryAlbums.userId, userId),
          eq(libraryAlbums.spotifyId, albumData.spotifyId),
        ),
      });
      if (existing) {
        return { error: "Album already exists in your library" };
      }

      const [album] = await db()
        .insert(libraryAlbums)
        .values({
          id: albumData.id,
          userId,
          spotifyId: albumData.spotifyId,
          name: albumData.name,
          artistName: albumData.artistName || "",
          releaseDate: albumData.releaseDate,
          imageUrl: albumData.imageUrl,
          totalTracks: albumData.totalTracks || 0,
        })
        .returning();

      return { album: album! };
    },

    /** Remove an album and cascade-delete orphaned tracks */
    async removeAlbum(
      userId: string,
      albumId: string,
      onProgress?: (phase: string) => void,
    ): Promise<void> {
      onProgress?.("removing_sources");

      const sourceEntries = await db().query.libraryTrackSources.findMany({
        where: and(
          eq(libraryTrackSources.userId, userId),
          eq(libraryTrackSources.sourceType, "album"),
          eq(libraryTrackSources.albumId, albumId),
        ),
      });

      const trackIds = sourceEntries.map((s: LibraryTrackSource) => s.trackId);

      await db()
        .delete(libraryTrackSources)
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "album"),
            eq(libraryTrackSources.albumId, albumId),
          ),
        );

      if (trackIds.length > 0) {
        onProgress?.("cleaning_up");

        const orphanedTracks = await db()
          .select({ id: libraryTracks.id })
          .from(libraryTracks)
          .where(
            and(
              inArray(libraryTracks.id, trackIds),
              notExists(
                db()
                  .select({ id: libraryTrackSources.id })
                  .from(libraryTrackSources)
                  .where(eq(libraryTrackSources.trackId, libraryTracks.id)),
              ),
            ),
          );

        for (const track of orphanedTracks) {
          await db().delete(libraryTracks).where(eq(libraryTracks.id, track.id));
        }
      }

      await db()
        .delete(libraryAlbums)
        .where(and(eq(libraryAlbums.userId, userId), eq(libraryAlbums.id, albumId)));
    },

    /** Update user library stats */
    async updateUserLibraryStats(userId: string): Promise<void> {
      const [trackResult] = await db()
        .select({ count: count() })
        .from(libraryTracks)
        .where(eq(libraryTracks.userId, userId));

      const [playlistResult] = await db()
        .select({ count: count() })
        .from(libraryPlaylists)
        .where(eq(libraryPlaylists.userId, userId));

      const [albumResult] = await db()
        .select({ count: count() })
        .from(libraryAlbums)
        .where(eq(libraryAlbums.userId, userId));

      await db()
        .insert(userLibraryStats)
        .values({
          userId,
          totalSongs: Number(trackResult?.count ?? 0),
          totalPlaylists: Number(playlistResult?.count ?? 0),
          totalAlbums: Number(albumResult?.count ?? 0),
        })
        .onConflictDoUpdate({
          target: userLibraryStats.userId,
          set: {
            totalSongs: Number(trackResult?.count ?? 0),
            totalPlaylists: Number(playlistResult?.count ?? 0),
            totalAlbums: Number(albumResult?.count ?? 0),
            lastUpdated: new Date(),
          },
        });
    },

    // ── Composite reads ────────────────────────────────────────────────

    /** Get user's full library with stats */
    async getUserLibraryData(userId: string): Promise<UserLibraryResponse> {
      const [tracks, playlists, albums, stats] = await Promise.all([
        this.getUserLibrary(userId),
        this.getUserPlaylists(userId),
        this.getUserAlbums(userId),
        this.getUserLibraryStats(userId),
      ]);

      return {
        tracks: tracks.map((t) => ({
          id: t.track.id,
          spotifyId: t.track.spotifyId,
          name: t.track.name,
          artist: t.track.artists.map((a) => a.name).join(", "),
          album: t.track.albumName,
          duration: t.track.durationMs,
          addedAt: t.track.addedAt,
          sources: t.sources.map((s) => ({
            type: s.sourceType,
            playlistId: s.playlistId || undefined,
            albumId: s.albumId || undefined,
          })),
        })),
        playlists: playlists.map((p) => ({
          id: p.id,
          name: p.name,
          imageUrl: p.imageUrl,
          trackCount: p.trackCount,
          addedAt: p.addedAt,
        })),
        albums: albums.map((a) => ({
          id: a.id,
          name: a.name,
          artistName: a.artistName,
          imageUrl: a.imageUrl,
          totalTracks: a.totalTracks,
          addedAt: a.addedAt,
        })),
        stats: stats
          ? {
              totalSongs: stats.totalSongs,
              totalPlaylists: stats.totalPlaylists,
              totalAlbums: stats.totalAlbums,
              lastUpdated: stats.lastUpdated,
            }
          : { totalSongs: 0, totalPlaylists: 0, totalAlbums: 0, lastUpdated: new Date() },
      };
    },

    // ── Batch operations (Phase 2+) ────────────────────────────────────

    /** Add tracks with a playlist source */
    async addTracksFromPlaylist(
      userId: string,
      playlistId: string,
      tracks: TrackData[],
      onProgress?: (current: number, total: number) => void,
    ): Promise<{ track: LibraryTrack; source: LibraryTrackSource }[]> {
      return batchInsertTracks(userId, tracks, "playlist", playlistId, onProgress);
    },

    /** Add tracks with an album source */
    async addTracksFromAlbum(
      userId: string,
      albumId: string,
      tracks: TrackData[],
      onProgress?: (current: number, total: number) => void,
    ): Promise<{ track: LibraryTrack; source: LibraryTrackSource }[]> {
      return batchInsertTracks(userId, tracks, "album", albumId, onProgress);
    },

    // ── Blend ──────────────────────────────────────────────────────────

    /** Blend libraries from multiple users for a room */
    async getRoomBlendedPlaylist(
      userIds: string[],
      targetTrackCount: number = 30,
      options?: { minTracksPerUser?: number },
    ): Promise<BlendResult> {
      const warnings: string[] = [];

      const userTracksMap = await this.getTracksForUsers(userIds);

      const userLibraries: { userId: string; tracks: LibraryTrackRecord[] }[] = [];
      for (const userId of userIds) {
        const tracks = userTracksMap.get(userId) || [];
        userLibraries.push({ userId, tracks });
      }

      if (options?.minTracksPerUser) {
        for (const ul of userLibraries) {
          if (ul.tracks.length < options.minTracksPerUser) {
            warnings.push(
              `User ${ul.userId} has ${ul.tracks.length} tracks (minimum: ${options.minTracksPerUser})`,
            );
          }
        }
      }

      const perUserTarget = Math.floor(targetTrackCount / userIds.length);
      const blendedLibraries = userLibraries.map((ul) => ({
        userId: ul.userId,
        tracks: shuffleArray(ul.tracks).slice(0, perUserTarget),
      }));

      let combined = combineAllTracks(blendedLibraries, targetTrackCount);
      combined = shuffleArray(combined);

      if (combined.length < MIN_TOTAL_TRACKS) {
        warnings.push(`Only ${combined.length} tracks available (minimum: ${MIN_TOTAL_TRACKS})`);
      }

      const songs: Song[] = combined.slice(0, targetTrackCount).map((track) => ({
        id: track.id,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.albumName,
        albumImageUrl: track.albumImageUrl ?? undefined,
        previewUrl: undefined,
        duration: track.durationMs || 0,
      }));

      return { songs, warnings };
    },
  };
}

// ── Pure helpers (no db needed) ──────────────────────────────────────────────

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = result[i]!;
    result[i] = result[j]!;
    result[j] = temp;
  }
  return result;
}

function deduplicateBySpotifyId(tracks: LibraryTrack[]): LibraryTrack[] {
  const seen = new Set<string>();
  return tracks.filter((track) => {
    if (seen.has(track.spotifyId)) return false;
    seen.add(track.spotifyId);
    return true;
  });
}

function combineAllTracks(
  userLibraries: { userId: string; tracks: LibraryTrack[] }[],
  targetTotalTracks: number,
): LibraryTrack[] {
  const allTracks: LibraryTrack[] = [];
  for (const library of userLibraries) {
    allTracks.push(...library.tracks);
  }

  const uniqueTracks = deduplicateBySpotifyId(allTracks);

  if (uniqueTracks.length >= targetTotalTracks) {
    return shuffleArray(uniqueTracks).slice(0, targetTotalTracks);
  }
  return uniqueTracks;
}
