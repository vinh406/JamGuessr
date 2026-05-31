import { DurableObject } from "cloudflare:workers";
import type { Song } from "../shared/types";
import { BATCH_SIZE, CONCURRENCY, fetchPartnerPage } from "./lib/spotify/partner-api";

const MAX_PAGES_PER_INVOCATION = 45;

export class PlaylistImportDO extends DurableObject {
  async fetch(request: Request): Promise<Response> {
    const { playlistId, accessToken, offset, total } = (await request.json()) as {
      playlistId: string;
      accessToken: string;
      offset: number;
      total: number;
    };

    const endOffset = Math.min(offset + MAX_PAGES_PER_INVOCATION * BATCH_SIZE, total);

    const offsets: number[] = [];
    for (let o = offset; o < endOffset; o += BATCH_SIZE) {
      offsets.push(o);
    }

    const allTracks: Song[] = [];
    for (let i = 0; i < offsets.length; i += CONCURRENCY) {
      const batch = offsets.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((o) => fetchPartnerPage(playlistId, accessToken, o)),
      );
      for (const page of results) {
        allTracks.push(...page);
      }
    }

    const nextOffset = endOffset < total ? endOffset : null;

    return new Response(JSON.stringify({ tracks: allTracks, nextOffset }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
