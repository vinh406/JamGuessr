import { DurableObject } from "cloudflare:workers";
import {
  BATCH_SIZE,
  CONCURRENCY,
  PAGES_PER_CHUNK,
  fetchPartnerPage,
} from "../services/spotify/partner-api";
import { extractSpotifyEmbedToken } from "../services/spotify/playlists";
import { getDb } from "../db";
import { libraryTracks, libraryTrackSources } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

const DB_BATCH_SIZE = 25;

export class PlaylistImportDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const { playlistId, offset, total, userId, containerId } = (await request.json()) as {
      playlistId: string;
      offset: number;
      total: number;
      userId: string;
      containerId: string;
    };

    const endOffset = Math.min(offset + PAGES_PER_CHUNK * BATCH_SIZE, total);

    try {
      const accessToken = await extractSpotifyEmbedToken("playlist", playlistId);
      if (!accessToken) {
        return Response.json({ error: "Could not get Spotify access token" }, { status: 400 });
      }

      const allTracks: Awaited<ReturnType<typeof fetchPartnerPage>> = [];
      const offsets: number[] = [];
      for (let o = offset; o < endOffset; o += BATCH_SIZE) {
        offsets.push(o);
      }

      for (let i = 0; i < offsets.length; i += CONCURRENCY) {
        const batch = offsets.slice(i, i + CONCURRENCY);
        const results = await Promise.all(
          batch.map((o) => fetchPartnerPage(playlistId, accessToken, o)),
        );
        for (const page of results) {
          allTracks.push(...page);
        }
      }

      if (allTracks.length === 0) {
        return Response.json({ tracksAdded: 0, tracksSkipped: 0 });
      }

      const db = getDb(this.env.HYPERDRIVE.connectionString);
      const spotifyIds = allTracks.map((t) => t.id);

      const existingTracks = await db
        .select()
        .from(libraryTracks)
        .where(and(eq(libraryTracks.userId, userId), inArray(libraryTracks.spotifyId, spotifyIds)));

      const existingBySpotifyId = new Map(existingTracks.map((t) => [t.spotifyId, t]));
      let tracksAdded = 0;

      for (let i = 0; i < allTracks.length; i += DB_BATCH_SIZE) {
        const chunk = allTracks.slice(i, i + DB_BATCH_SIZE);

        const newTracksData = chunk
          .filter((t) => !existingBySpotifyId.has(t.id))
          .map((t) => ({
            userId,
            spotifyId: t.id,
            name: t.title,
            artists: [{ name: t.artist }],
            albumName: t.album || "",
            albumImageUrl: t.albumImageUrl,
            durationMs: t.duration || 0,
          }));

        const insertedTracks: (typeof existingTracks)[number][] = [];
        if (newTracksData.length > 0) {
          insertedTracks.push(
            ...(await db
              .insert(libraryTracks)
              .values(newTracksData)
              .onConflictDoNothing()
              .returning()),
          );
        }

        tracksAdded += insertedTracks.length;

        const insertedBySpotifyId = new Map(insertedTracks.map((t) => [t.spotifyId, t]));

        const sourceValues = chunk
          .map((td) => {
            const existing = existingBySpotifyId.get(td.id);
            const inserted = insertedBySpotifyId.get(td.id);
            const trackId = existing?.id ?? inserted?.id;
            if (!trackId) return null;
            return {
              trackId,
              userId,
              sourceType: "playlist" as const,
              playlistId: containerId,
            };
          })
          .filter((s): s is NonNullable<typeof s> => s !== null);

        if (sourceValues.length > 0) {
          await db.insert(libraryTrackSources).values(sourceValues);
        }
      }

      return Response.json({ tracksAdded, tracksSkipped: allTracks.length - tracksAdded });
    } catch (error) {
      return Response.json({ error: String(error) }, { status: 500 });
    }
  }
}
