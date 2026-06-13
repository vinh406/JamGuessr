import { DurableObject } from "cloudflare:workers";
import { BATCH_SIZE, CONCURRENCY, fetchPartnerPage } from "../services/spotify/partner-api";

const MAX_PAGES_PER_INVOCATION = 45;
const ENCODER = new TextEncoder();

export class PlaylistImportDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const { playlistId, accessToken, offset, total } = (await request.json()) as {
      playlistId: string;
      accessToken: string;
      offset: number;
      total: number;
    };

    const endOffset = Math.min(offset + MAX_PAGES_PER_INVOCATION * BATCH_SIZE, total);

    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    this.streamResults(writer, playlistId, accessToken, offset, endOffset, total);

    return new Response(readable, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  private async streamResults(
    writer: WritableStreamDefaultWriter<Uint8Array>,
    playlistId: string,
    accessToken: string,
    startOffset: number,
    endOffset: number,
    total: number,
  ): Promise<void> {
    try {
      const allTracks: Awaited<ReturnType<typeof fetchPartnerPage>> = [];
      const nextOffset: number | null = endOffset < total ? endOffset : null;

      const offsets: number[] = [];
      for (let o = startOffset; o < endOffset; o += BATCH_SIZE) {
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
        await writer.write(
          ENCODER.encode(
            JSON.stringify({ type: "progress", current: startOffset + allTracks.length, total }) +
              "\n",
          ),
        );
      }

      await writer.write(
        ENCODER.encode(JSON.stringify({ type: "done", tracks: allTracks, nextOffset }) + "\n"),
      );
    } catch (err) {
      await writer.write(
        ENCODER.encode(JSON.stringify({ type: "error", message: String(err) }) + "\n"),
      );
    } finally {
      await writer.close().catch(() => {});
    }
  }
}
