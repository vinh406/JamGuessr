import { eq, and, inArray, count, exists, lt, desc } from "drizzle-orm";
import type { DbInstance } from "../../db";
import { shuffleArray, formatDate } from "../../../shared/utils";
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
  id?: string;
  spotifyId: string;
  name: string;
  artists: { name: string; id?: string }[];
  albumName?: string;
  albumId?: string;
  albumImageUrl?: string;
  previewUrl?: string;
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

export interface LibraryItem {
  type: "playlist" | "album" | "tracks";
  id: string;
  spotifyId?: string;
  name: string;
  artists?: { name: string }[];
  imageUrl?: string;
  trackCount: number;
  addedAt: string;
}

export interface TrackItem {
  id: string;
  spotifyId: string;
  name: string;
  artists: { name: string; id?: string }[];
  albumName?: string;
  albumId?: string;
  albumImageUrl?: string;
  durationMs?: number;
  addedAt: string;
}

export interface PaginatedItems {
  items: LibraryItem[];
  nextCursor: string | null;
}

export interface PaginatedTracks {
  tracks: TrackItem[];
  nextCursor: string | null;
}

export interface BlendResult {
  songs: Song[];
  warnings: string[];
}

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Create a LibraryService bound to a single request.
 *
 * Call this once per request with the connection string; the returned
 * object exposes all library operations without needing a `db` parameter.
 */
export function createLibraryService(
  db: DbInstance,
  env?: { PLAYLIST_IMPORT_DO?: DurableObjectNamespace },
) {
  const BATCH_SIZE = 25;

  // ── Internal query helpers (not exported) ──────────────────────────────

  async function trackExistsBySpotifyId(
    userId: string,
    spotifyId: string,
  ): Promise<LibraryTrack | undefined> {
    return db.query.libraryTracks.findFirst({
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

    const existingTracks = await db
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
          userId,
          spotifyId: t.spotifyId,
          name: t.name,
          artists: t.artists,
          albumName: t.albumName || "",
          albumId: t.albumId,
          albumImageUrl: t.albumImageUrl,
          previewUrl: t.previewUrl,
          durationMs: t.durationMs || 0,
        }));

      const insertedTracks: LibraryTrack[] = [];
      if (newTracksData.length > 0) {
        insertedTracks.push(
          ...(await db
            .insert(libraryTracks)
            .values(newTracksData)
            .onConflictDoNothing()
            .returning()),
        );
      }

      const insertedBySpotifyId = new Map(insertedTracks.map((t) => [t.spotifyId, t]));

      const sourceValues = chunk
        .map((td) => {
          const existing = existingBySpotifyId.get(td.spotifyId);
          const inserted = insertedBySpotifyId.get(td.spotifyId);
          const trackId = existing?.id ?? inserted?.id;
          if (!trackId) return null;
          return {
            trackId,
            userId,
            sourceType,
            ...(sourceType === "playlist" ? { playlistId: containerId } : { albumId: containerId }),
          };
        })
        .filter((s): s is NonNullable<typeof s> => s !== null);

      const insertedSources: LibraryTrackSource[] = [];
      if (sourceValues.length > 0) {
        insertedSources.push(
          ...(await db.insert(libraryTrackSources).values(sourceValues).returning()),
        );
      }

      const sourceByTrackId = new Map(insertedSources.map((s) => [s.trackId, s]));
      const allTracksBySpotifyId = new Map([...existingBySpotifyId, ...insertedBySpotifyId]);

      for (const td of chunk) {
        const track = allTracksBySpotifyId.get(td.spotifyId);
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
      const tracks = await db.query.libraryTracks.findMany({
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
      return db.query.libraryTracks.findFirst({
        where: eq(libraryTracks.id, trackId),
      });
    },

    /** Get user's playlists */
    async getUserPlaylists(userId: string): Promise<PlaylistRecord[]> {
      return db.query.libraryPlaylists.findMany({
        where: eq(libraryPlaylists.userId, userId),
      });
    },

    /** Get a playlist by ID */
    async getPlaylistById(playlistId: string): Promise<PlaylistRecord | null> {
      const playlist = await db.query.libraryPlaylists.findFirst({
        where: eq(libraryPlaylists.id, playlistId),
      });
      return playlist ?? null;
    },

    /** Get a playlist by Spotify ID for a specific user */
    async getPlaylistBySpotifyId(
      userId: string,
      spotifyId: string,
    ): Promise<PlaylistRecord | null> {
      const playlist = await db.query.libraryPlaylists.findFirst({
        where: and(eq(libraryPlaylists.userId, userId), eq(libraryPlaylists.spotifyId, spotifyId)),
      });
      return playlist ?? null;
    },

    /** Get user's albums */
    async getUserAlbums(userId: string): Promise<AlbumRecord[]> {
      return db.query.libraryAlbums.findMany({
        where: eq(libraryAlbums.userId, userId),
      });
    },

    /** Get an album by ID */
    async getAlbumById(albumId: string): Promise<AlbumRecord | null> {
      const album = await db.query.libraryAlbums.findFirst({
        where: eq(libraryAlbums.id, albumId),
      });
      return album ?? null;
    },

    /** Get user library stats */
    async getUserLibraryStats(userId: string): Promise<LibraryStatsRecord | undefined> {
      return db.query.userLibraryStats.findFirst({
        where: eq(userLibraryStats.userId, userId),
      });
    },

    /** Get tracks for a playlist stored in the user's library, by Spotify playlist ID */
    async getLibraryPlaylistTracks(userId: string, spotifyId: string): Promise<Song[]> {
      const playlist = await db.query.libraryPlaylists.findFirst({
        where: and(eq(libraryPlaylists.userId, userId), eq(libraryPlaylists.spotifyId, spotifyId)),
      });
      if (!playlist) return [];

      const sources = await db.query.libraryTrackSources.findMany({
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
          previewUrl: s.track.previewUrl ?? undefined,
          duration: s.track.durationMs || 0,
        }));
    },

    /** Get all tracks for multiple users (for blend algorithm) */
    async getTracksForUsers(userIds: string[]): Promise<Map<string, LibraryTrack[]>> {
      const tracks = await db
        .select()
        .from(libraryTracks)
        .where(
          and(
            inArray(libraryTracks.userId, userIds),
            exists(
              db
                .select({ id: libraryTrackSources.id })
                .from(libraryTrackSources)
                .where(eq(libraryTrackSources.trackId, libraryTracks.id)),
            ),
          ),
        );

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

      const [track] = await db
        .insert(libraryTracks)
        .values({
          userId,
          spotifyId: trackData.spotifyId,
          name: trackData.name,
          artists: trackData.artists,
          albumName: trackData.albumName || "",
          albumId: trackData.albumId,
          albumImageUrl: trackData.albumImageUrl,
          previewUrl: trackData.previewUrl,
          durationMs: trackData.durationMs || 0,
        })
        .returning();

      const [source] = await db
        .insert(libraryTrackSources)
        .values({
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
        albumImageUrl?: string;
        previewUrl?: string;
        durationMs?: number;
      },
    ): Promise<{ success: true; trackId: string } | { success: false; error: string }> {
      const result = await this.addTrack(userId, trackData);

      if ("error" in result) {
        return { success: false, error: result.error };
      }

      await this.updateUserLibraryStats(userId);
      return { success: true, trackId: result.track.id };
    },

    /** Remove a track and all its source entries */
    async removeTrack(userId: string, trackId: string): Promise<void> {
      await db
        .delete(libraryTrackSources)
        .where(
          and(eq(libraryTrackSources.userId, userId), eq(libraryTrackSources.trackId, trackId)),
        );

      await db
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
      onFetchProgress?: (current: number, total: number) => void,
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
            albumImageUrl: metadata.imageUrl || undefined,
            previewUrl: metadata.previewUrl || undefined,
            durationMs: metadata.durationMs || undefined,
          });

          if (!result.success) return result;
          return { success: true, type: "track", id: result.trackId };
        }

        case "playlist": {
          // Check for duplicate before slow Spotify API calls
          const existingPlaylist = await db.query.libraryPlaylists.findFirst({
            where: and(
              eq(libraryPlaylists.userId, userId),
              eq(libraryPlaylists.spotifyId, parsed.id),
            ),
          });
          if (existingPlaylist) {
            return { success: false, error: "Playlist already exists in your library" };
          }

          const [metadata, tracks] = await Promise.all([
            getPlaylistMetadata(parsed.id),
            getPlaylistTracks(parsed.id, env?.PLAYLIST_IMPORT_DO, undefined, onFetchProgress),
          ]);

          if (!metadata) {
            return { success: false, error: "Failed to fetch playlist metadata from Spotify" };
          }

          // Create the playlist record
          const { playlist } = await this.addPlaylist(userId, {
            spotifyId: parsed.id,
            name: metadata.name,
            imageUrl: metadata.imageUrl,
            trackCount: metadata.trackCount,
          });

          // Add all tracks with playlist source
          const trackData = tracks.map((t) => ({
            spotifyId: t.id,
            name: t.title,
            artists: [{ name: t.artist }],
            albumName: t.album || undefined,
            albumImageUrl: t.albumImageUrl || undefined,
            previewUrl: t.previewUrl || undefined,
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
          // Check for duplicate before slow Spotify API calls
          const existingAlbum = await db.query.libraryAlbums.findFirst({
            where: and(eq(libraryAlbums.userId, userId), eq(libraryAlbums.spotifyId, parsed.id)),
          });
          if (existingAlbum) {
            return { success: false, error: "Album already exists in your library" };
          }

          const [metadata, tracks] = await Promise.all([
            getAlbumMetadata(parsed.id),
            getAlbumTracks(parsed.id),
          ]);

          if (!metadata) {
            return { success: false, error: "Failed to fetch album metadata from Spotify" };
          }

          // Create the album record
          const { album } = await this.addAlbum(userId, {
            spotifyId: parsed.id,
            name: metadata.name,
            artistName: metadata.artistName,
            releaseDate: metadata.releaseDate ?? undefined,
            imageUrl: metadata.imageUrl,
            totalTracks: metadata.totalTracks,
          });

          // Add all tracks with album source
          const trackData = tracks.map((t) => ({
            spotifyId: t.id,
            name: t.title,
            artists: [{ name: t.artist }],
            albumName: t.album || metadata.name,
            albumId: album.id,
            albumImageUrl: metadata.imageUrl || undefined,
            previewUrl: t.previewUrl || undefined,
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

    /** Add a playlist (caller must check for duplicates first) */
    async addPlaylist(
      userId: string,
      playlistData: {
        spotifyId: string;
        name: string;
        imageUrl?: string;
        trackCount: number;
      },
    ): Promise<{ playlist: PlaylistRecord }> {
      const [playlist] = await db
        .insert(libraryPlaylists)
        .values({
          userId,
          spotifyId: playlistData.spotifyId,
          name: playlistData.name,
          imageUrl: playlistData.imageUrl,
          trackCount: playlistData.trackCount,
        })
        .returning();

      return { playlist: playlist! };
    },

    /** Remove a playlist and its source entries (tracks are kept for other sources) */
    async removePlaylist(userId: string, playlistId: string): Promise<void> {
      await db
        .delete(libraryTrackSources)
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "playlist"),
            eq(libraryTrackSources.playlistId, playlistId),
          ),
        );

      await db
        .delete(libraryPlaylists)
        .where(and(eq(libraryPlaylists.userId, userId), eq(libraryPlaylists.id, playlistId)));
    },

    /** Add an album (caller must check for duplicates first) */
    async addAlbum(
      userId: string,
      albumData: {
        spotifyId: string;
        name: string;
        artistName?: string;
        releaseDate?: string;
        imageUrl?: string;
        totalTracks?: number;
      },
    ): Promise<{ album: AlbumRecord }> {
      const [album] = await db
        .insert(libraryAlbums)
        .values({
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

    /** Remove an album and its source entries (tracks are kept for other sources) */
    async removeAlbum(userId: string, albumId: string): Promise<void> {
      await db
        .delete(libraryTrackSources)
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "album"),
            eq(libraryTrackSources.albumId, albumId),
          ),
        );

      await db
        .delete(libraryAlbums)
        .where(and(eq(libraryAlbums.userId, userId), eq(libraryAlbums.id, albumId)));
    },

    /** Update user library stats */
    async updateUserLibraryStats(userId: string): Promise<void> {
      const [trackResult] = await db
        .select({ count: count() })
        .from(libraryTracks)
        .where(
          and(
            eq(libraryTracks.userId, userId),
            exists(
              db
                .select({ id: libraryTrackSources.id })
                .from(libraryTrackSources)
                .where(eq(libraryTrackSources.trackId, libraryTracks.id)),
            ),
          ),
        );

      const [playlistResult] = await db
        .select({ count: count() })
        .from(libraryPlaylists)
        .where(eq(libraryPlaylists.userId, userId));

      const [albumResult] = await db
        .select({ count: count() })
        .from(libraryAlbums)
        .where(eq(libraryAlbums.userId, userId));

      await db
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

    // ── Paginated reads ─────────────────────────────────────────────

    async getItems(userId: string, cursor?: string, limit: number = 20): Promise<PaginatedItems> {
      const cursorDate = cursor ? new Date(cursor) : undefined;
      const take = limit + 1;

      const playlistWhere = cursorDate
        ? and(eq(libraryPlaylists.userId, userId), lt(libraryPlaylists.addedAt, cursorDate))
        : eq(libraryPlaylists.userId, userId);

      const albumWhere = cursorDate
        ? and(eq(libraryAlbums.userId, userId), lt(libraryAlbums.addedAt, cursorDate))
        : eq(libraryAlbums.userId, userId);

      const [playlists, albums] = await Promise.all([
        db.query.libraryPlaylists.findMany({
          where: playlistWhere,
          orderBy: (t, { desc }) => [desc(t.addedAt)],
          limit: take,
        }),
        db.query.libraryAlbums.findMany({
          where: albumWhere,
          orderBy: (t, { desc }) => [desc(t.addedAt)],
          limit: take,
        }),
      ]);

      const items: LibraryItem[] = [];

      for (const p of playlists) {
        items.push({
          type: "playlist",
          id: p.id,
          spotifyId: p.spotifyId,
          name: p.name,
          imageUrl: p.imageUrl ?? undefined,
          trackCount: p.trackCount,
          addedAt: formatDate(p.addedAt),
        });
      }

      for (const a of albums) {
        items.push({
          type: "album",
          id: a.id,
          spotifyId: a.spotifyId,
          name: a.name,
          imageUrl: a.imageUrl ?? undefined,
          trackCount: a.totalTracks,
          addedAt: formatDate(a.addedAt),
          artists: [{ name: a.artistName }],
        });
      }

      items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));

      if (!cursor) {
        const directCount = await this.getDirectTrackCount(userId);
        if (directCount > 0) {
          items.unshift({
            type: "tracks",
            id: "direct",
            name: "Tracks",
            trackCount: directCount,
            addedAt: new Date().toISOString(),
          });
        }
      }

      const hasMore = items.length > limit;
      const pageItems = items.slice(0, limit);
      const nextCursor = hasMore ? items[limit]!.addedAt : null;

      return { items: pageItems, nextCursor };
    },

    async getDirectTrackCount(userId: string): Promise<number> {
      const [result] = await db
        .select({ count: count() })
        .from(libraryTracks)
        .where(
          and(
            eq(libraryTracks.userId, userId),
            exists(
              db
                .select({ id: libraryTrackSources.id })
                .from(libraryTrackSources)
                .where(
                  and(
                    eq(libraryTrackSources.trackId, libraryTracks.id),
                    eq(libraryTrackSources.sourceType, "direct"),
                  ),
                ),
            ),
          ),
        );
      return Number(result?.count ?? 0);
    },

    async getDirectTracks(
      userId: string,
      cursor?: string,
      limit: number = 50,
    ): Promise<PaginatedTracks> {
      const cursorDate = cursor ? new Date(cursor) : undefined;

      const tracks = await db.query.libraryTracks.findMany({
        where: (t, { and: andOp, lt, eq, exists: existsOp }) => {
          const conditions = [
            eq(t.userId, userId),
            existsOp(
              db
                .select({ id: libraryTrackSources.id })
                .from(libraryTrackSources)
                .where(
                  and(
                    eq(libraryTrackSources.trackId, t.id),
                    eq(libraryTrackSources.sourceType, "direct"),
                  ),
                ),
            ),
          ];
          if (cursorDate) {
            conditions.push(lt(t.addedAt, cursorDate));
          }
          return andOp(...conditions);
        },
        orderBy: (t, { desc }) => [desc(t.addedAt)],
        limit: limit + 1,
      });

      return this.formatTrackPage(tracks, limit);
    },

    async getPlaylistTracksPaginated(
      userId: string,
      spotifyId: string,
      cursor?: string,
      limit: number = 50,
    ): Promise<PaginatedTracks> {
      const playlist = await db.query.libraryPlaylists.findFirst({
        where: and(eq(libraryPlaylists.userId, userId), eq(libraryPlaylists.spotifyId, spotifyId)),
      });
      if (!playlist) return { tracks: [], nextCursor: null };

      const cursorDate = cursor ? new Date(cursor) : undefined;

      const result = await db
        .select()
        .from(libraryTrackSources)
        .innerJoin(libraryTracks, eq(libraryTrackSources.trackId, libraryTracks.id))
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "playlist"),
            eq(libraryTrackSources.playlistId, playlist.id),
            cursorDate ? lt(libraryTracks.addedAt, cursorDate) : undefined,
          ),
        )
        .orderBy(desc(libraryTracks.addedAt))
        .limit(limit + 1);

      const tracks = result.map((r) => r.library_tracks);
      return this.formatTrackPage(tracks, limit);
    },

    async getAlbumTracksPaginated(
      userId: string,
      spotifyId: string,
      cursor?: string,
      limit: number = 50,
    ): Promise<PaginatedTracks> {
      const album = await db.query.libraryAlbums.findFirst({
        where: and(eq(libraryAlbums.userId, userId), eq(libraryAlbums.spotifyId, spotifyId)),
      });
      if (!album) return { tracks: [], nextCursor: null };

      const cursorDate = cursor ? new Date(cursor) : undefined;

      const result = await db
        .select()
        .from(libraryTrackSources)
        .innerJoin(libraryTracks, eq(libraryTrackSources.trackId, libraryTracks.id))
        .where(
          and(
            eq(libraryTrackSources.userId, userId),
            eq(libraryTrackSources.sourceType, "album"),
            eq(libraryTrackSources.albumId, album.id),
            cursorDate ? lt(libraryTracks.addedAt, cursorDate) : undefined,
          ),
        )
        .orderBy(desc(libraryTracks.addedAt))
        .limit(limit + 1);

      const tracks = result.map((r) => r.library_tracks);
      return this.formatTrackPage(tracks, limit);
    },

    formatTrackPage(tracks: LibraryTrack[], limit: number): PaginatedTracks {
      const hasMore = tracks.length > limit;
      const page = hasMore ? tracks.slice(0, limit) : tracks;

      return {
        tracks: page.map((t) => ({
          id: t.id,
          spotifyId: t.spotifyId,
          name: t.name,
          artists: t.artists as { name: string; id?: string }[],
          albumName: t.albumName ?? undefined,
          albumId: t.albumId ?? undefined,
          albumImageUrl: t.albumImageUrl ?? undefined,
          durationMs: t.durationMs ?? undefined,
          addedAt: formatDate(t.addedAt),
        })),
        nextCursor: hasMore ? formatDate(page[page.length - 1]!.addedAt) : null,
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
      options?: {
        minTracksPerUser?: number;
        excludeSpotifyIds?: string[];
        userInfoMap?: Record<string, { userId: string; username: string; userImage?: string }>;
      },
    ): Promise<BlendResult> {
      const warnings: string[] = [];

      const userTracksMap = await this.getTracksForUsers(userIds);

      const userLibraries: { userId: string; tracks: LibraryTrackRecord[] }[] = [];
      for (const userId of userIds) {
        let tracks = userTracksMap.get(userId) || [];
        if (options?.excludeSpotifyIds?.length) {
          const exclude = new Set(options.excludeSpotifyIds);
          tracks = tracks.filter((t) => !exclude.has(t.spotifyId));
        }
        userLibraries.push({ userId, tracks });
      }

      if (options?.minTracksPerUser) {
        for (const ul of userLibraries) {
          if (ul.tracks.length < options.minTracksPerUser) {
            warnings.push(
              `User ${options.userInfoMap?.[ul.userId]?.username ?? ul.userId} has ${ul.tracks.length} tracks (minimum: ${options.minTracksPerUser})`,
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

      const songs: Song[] = combined.slice(0, targetTrackCount).map((track) => ({
        id: track.spotifyId,
        title: track.name,
        artist: track.artists.map((a) => a.name).join(", "),
        album: track.albumName,
        albumImageUrl: track.albumImageUrl ?? undefined,
        previewUrl: track.previewUrl ?? undefined,
        duration: track.durationMs || 0,
        submittedBy: options?.userInfoMap?.[track.userId],
      }));

      return { songs, warnings };
    },
  };
}

// ── Pure helpers (no db needed) ──────────────────────────────────────────────

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
