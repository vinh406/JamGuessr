import type { Song } from "../../../shared/types";

export const PARTNER_QUERY_HASH =
  "a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4";
export const BATCH_SIZE = 50;
export const CONCURRENCY = 10;
export const PAGES_PER_CHUNK = 45;

export interface PartnerTrack {
  itemV2: {
    data: {
      __typename: string;
      uri: string;
      name: string;
      artists: { items: { profile: { name: string }; uri: string }[] };
      albumOfTrack: {
        name: string;
        coverArt: { sources: { url: string; height: number; width: number }[] };
      };
      trackDuration: { totalMilliseconds: number };
      playability: { playable: boolean; reason: string };
    };
  };
}

export interface PartnerPlaylistResponse {
  data: {
    playlistV2: {
      content: {
        items: PartnerTrack[];
        totalCount: number;
        pagingInfo: { limit: number; offset: number };
      };
    };
  };
}

export function partnerTrackToSong(track: PartnerTrack): Song {
  const data = track.itemV2.data;
  return {
    id: data.uri.replace("spotify:track:", ""),
    title: data.name,
    artist: data.artists.items.map((a) => a.profile.name).join(", "),
    album: data.albumOfTrack.name,
    albumImageUrl:
      data.albumOfTrack.coverArt.sources.sort((a, b) => b.width - a.width)[0]?.url ?? undefined,
    previewUrl: undefined,
    duration: data.trackDuration.totalMilliseconds,
  };
}

export async function paginateFetch<T>(
  total: number,
  startOffset: number,
  batchSize: number,
  concurrency: number,
  fetcher: (offset: number) => Promise<T[]>,
  onProgress?: (current: number, total: number) => void,
): Promise<T[]> {
  const offsets: number[] = [];
  for (let o = startOffset; o < total; o += batchSize) {
    offsets.push(o);
  }

  const allResults: T[] = [];
  for (let i = 0; i < offsets.length; i += concurrency) {
    const batch = offsets.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((o) => fetcher(o)));
    for (const page of results) {
      allResults.push(...page);
    }
    onProgress?.(allResults.length, total);
  }

  return allResults;
}

export async function fetchPartnerPage(
  playlistId: string,
  accessToken: string,
  offset: number,
  fetchFn: typeof fetch = fetch,
): Promise<Song[]> {
  const response = await fetchFn("https://api-partner.spotify.com/pathfinder/v2/query", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=UTF-8",
      Authorization: `Bearer ${accessToken}`,
      "app-platform": "WebPlayer",
      "User-Agent": "Mozilla/5.0",
    },
    body: JSON.stringify({
      variables: {
        uri: `spotify:playlist:${playlistId}`,
        offset,
        limit: BATCH_SIZE,
        includeEpisodeContentRatingsV2: false,
      },
      operationName: "fetchPlaylistContents",
      extensions: {
        persistedQuery: {
          version: 1,
          sha256Hash: PARTNER_QUERY_HASH,
        },
      },
    }),
  });

  if (!response.ok) return [];

  const data: PartnerPlaylistResponse = await response.json();
  const items = data.data?.playlistV2?.content?.items ?? [];

  return items.filter((item) => item.itemV2?.data?.__typename === "Track").map(partnerTrackToSong);
}
