import { DurableObject } from "cloudflare:workers";
import type { Song } from "../../shared/types";
import { BATCH_SIZE, fetchPartnerPage } from "../services/spotify/partner-api";
import { getDb } from "../db";
import { libraryTracks, libraryTrackSources } from "../db/schema";
import { eq, and, inArray } from "drizzle-orm";

const ENCODER = new TextEncoder();
const GROUP_SIZE = BATCH_SIZE;

export class PlaylistImportDO extends DurableObject<Env> {
  async fetch(request: Request): Promise<Response> {
    const { playlistId, offset, endOffset, userId, containerId, accessToken } =
      (await request.json()) as {
        playlistId: string;
        offset: number;
        endOffset: number;
        userId: string;
        containerId: string;
        accessToken?: string;
      };

    if (!accessToken) {
      return Response.json({ error: "No access token provided" }, { status: 400 });
    }

    const { readable, writable } = new IdentityTransformStream();
    this.processChunk(
      writable.getWriter(),
      playlistId,
      accessToken,
      offset,
      endOffset,
      userId,
      containerId,
    );

    return new Response(readable);
  }

  private async processChunk(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    playlistId: string,
    accessToken: string,
    startOffset: number,
    endOffset: number,
    userId: string,
    containerId: string,
  ): Promise<void> {
    try {
      const db = getDb(this.env.HYPERDRIVE.connectionString);
      let tracksAdded = 0;
      let o = startOffset;

      // Prefetch kicks off the first group immediately
      let fetchGroupPromise = this.fetchGroup(playlistId, accessToken, startOffset, endOffset);

      while (true) {
        const nextO = o + GROUP_SIZE;

        // Start fetching the next group while we insert this one
        const nextGroupPromise =
          nextO < endOffset ? this.fetchGroup(playlistId, accessToken, nextO, endOffset) : null;

        const tracks = await fetchGroupPromise;

        if (tracks.length > 0) {
          const spotifyIds = tracks.map((t) => t.id);

          const existing = await db
            .select()
            .from(libraryTracks)
            .where(
              and(eq(libraryTracks.userId, userId), inArray(libraryTracks.spotifyId, spotifyIds)),
            );

          const existingMap = new Map(existing.map((t) => [t.spotifyId, t]));

          const newTracksData = tracks
            .filter((t) => !existingMap.has(t.id))
            .map((t) => ({
              userId,
              spotifyId: t.id,
              name: t.title,
              artists: [{ name: t.artist }],
              albumName: t.album || "",
              albumImageUrl: t.albumImageUrl,
              durationMs: t.duration || 0,
            }));

          const inserted: (typeof existing)[number][] = [];
          if (newTracksData.length > 0) {
            inserted.push(
              ...(await db
                .insert(libraryTracks)
                .values(newTracksData)
                .onConflictDoNothing()
                .returning()),
            );
          }

          tracksAdded += inserted.length;

          const allMap = new Map([
            ...existingMap,
            ...inserted.map((t) => [t.spotifyId, t] as const),
          ]);

          const sourceValues = tracks
            .map((td) => {
              const track = allMap.get(td.id);
              if (!track) return null;
              return {
                trackId: track.id,
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

        const processed = Math.min(nextO, endOffset) - startOffset;
        await writer.write(
          ENCODER.encode(JSON.stringify({ type: "progress", current: processed }) + "\n"),
        );

        if (!nextGroupPromise) break;

        fetchGroupPromise = nextGroupPromise;
        o = nextO;
      }

      await writer.write(ENCODER.encode(JSON.stringify({ type: "done", tracksAdded }) + "\n"));
    } catch {
      await writer.write(
        ENCODER.encode(
          JSON.stringify({ type: "error", message: "Failed to import playlist tracks" }) + "\n",
        ),
      );
    } finally {
      await writer.close().catch(() => {});
    }
  }

  private async fetchGroup(
    playlistId: string,
    accessToken: string,
    start: number,
    endOffset: number,
  ): Promise<Song[]> {
    const end = Math.min(start + GROUP_SIZE, endOffset);
    const promises: Promise<Song[]>[] = [];
    for (let o = start; o < end; o += BATCH_SIZE) {
      promises.push(fetchPartnerPage(playlistId, accessToken, o));
    }
    const results = await Promise.all(promises);
    return results.flat();
  }
}
