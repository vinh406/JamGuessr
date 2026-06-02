import { DurableObject } from "cloudflare:workers";
import { BATCH_SIZE, CONCURRENCY, fetchPartnerPage, paginateFetch } from "../lib/spotify/partner-api";

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

    const allTracks = await paginateFetch(endOffset, offset, BATCH_SIZE, CONCURRENCY, (o) =>
      fetchPartnerPage(playlistId, accessToken, o),
    );

    const nextOffset = endOffset < total ? endOffset : null;

    return new Response(JSON.stringify({ tracks: allTracks, nextOffset }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}
