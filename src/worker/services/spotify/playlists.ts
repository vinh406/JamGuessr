import type { Playlist, Song } from "../../../shared/types";
import spotifyUrlInfo from "spotify-url-info";
import {
  PARTNER_QUERY_HASH,
  BATCH_SIZE,
  CONCURRENCY,
  fetchPartnerPage,
  fetchPartnerAlbumAllTracks,
  paginateFetch,
  type PartnerPlaylistResponse,
} from "./partner-api";

// ── Embed page helpers (scrapes Spotify for full playlist data) ────────────────

interface SpotifyEmbedTrack {
  uri: string;
  title: string;
  artists?: { name: string }[];
  subtitle?: string;
  duration?: number;
  isPlayable?: boolean;
  audioPreview?: { url: string };
}

interface SpotifyEmbedEntity {
  type: string;
  name: string;
  uri: string;
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  trackList: SpotifyEmbedTrack[];
  coverArt?: { sources: { url: string; width: number; height: number }[] };
}

interface SpotifyEmbedSession {
  accessToken: string;
  accessTokenExpirationTimestampMs: number;
  isAnonymous: boolean;
}

interface SpotifyEmbedState {
  data: { entity: SpotifyEmbedEntity };
  settings: { session: SpotifyEmbedSession };
}

function getArtistString(artists?: { name: string }[]): string {
  if (!artists || !Array.isArray(artists)) return "";
  return artists
    .filter((a) => a?.name)
    .map((a) => a.name)
    .join(", ");
}

function embedTrackToSong(track: SpotifyEmbedTrack): Song {
  return {
    id: track.uri?.replace("spotify:track:", "") || "",
    title: track.title || "",
    artist: getArtistString(track.artists) || track.subtitle || "",
    album: "",
    albumImageUrl: undefined,
    previewUrl: track.isPlayable ? track.audioPreview?.url : undefined,
    duration: track.duration ?? 0,
  };
}

async function parseSpotifyEmbedPage(
  playlistId: string,
  fetchFn: typeof fetch = fetch,
): Promise<{
  entity: SpotifyEmbedEntity;
  accessToken: string;
} | null> {
  const url = `https://open.spotify.com/embed/playlist/${playlistId}`;

  const response = await fetchFn(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);

  if (!match?.[1]) return null;

  const parsed: { props: { pageProps: { state: SpotifyEmbedState } } } = JSON.parse(match[1]);
  const state = parsed.props?.pageProps?.state;
  if (!state) return null;

  const entity = state.data?.entity;
  const accessToken = state.settings?.session?.accessToken;
  if (!entity || !accessToken) return null;

  return { entity, accessToken };
}

export async function extractSpotifyEmbedToken(
  type: "playlist" | "album",
  id: string,
): Promise<string | null> {
  const url = `https://open.spotify.com/embed/${type}/${id}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Accept: "text/html,application/xhtml+xml",
    },
  });

  if (!response.ok) return null;

  const html = await response.text();
  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>(.*?)<\/script>/);
  if (!match?.[1]) return null;

  const parsed: {
    props: { pageProps: { state: { settings: { session: { accessToken: string } } } } };
  } = JSON.parse(match[1]);
  return parsed.props?.pageProps?.state?.settings?.session?.accessToken ?? null;
}

async function fetchPartnerPlaylistTracks(
  playlistId: string,
  accessToken: string,
  startOffset: number,
  total: number,
  fetchFn: typeof fetch = fetch,
  onFetchProgress?: (current: number, total: number) => void,
): Promise<Song[]> {
  return paginateFetch(
    total,
    startOffset,
    BATCH_SIZE,
    CONCURRENCY,
    (o) => fetchPartnerPage(playlistId, accessToken, o, fetchFn),
    onFetchProgress,
  );
}

// ── Spotify URL parsing ──────────────────────────────────────────────────────

export type SpotifyLinkType = "track" | "playlist" | "album";

export interface ParsedSpotifyLink {
  type: SpotifyLinkType;
  id: string;
}

/**
 * Parse any Spotify URL and auto-detect whether it's a track, playlist, or album.
 * Supports:
 *  - https://open.spotify.com/track/{id}...
 *  - spotify:track:{id}
 *  - spotify:playlist:{id}
 *  - spotify:album:{id}
 * Returns null if the link cannot be parsed.
 */
export function parseSpotifyLink(link: string): ParsedSpotifyLink | null {
  // URL format: https://open.spotify.com/{type}/{id}
  const urlPatterns: [SpotifyLinkType, RegExp][] = [
    ["track", /open\.spotify\.com\/track\/([a-zA-Z0-9]+)/],
    ["playlist", /open\.spotify\.com\/playlist\/([a-zA-Z0-9]+)/],
    ["album", /open\.spotify\.com\/album\/([a-zA-Z0-9]+)/],
  ];

  for (const [type, pattern] of urlPatterns) {
    const match = link.match(pattern);
    if (match?.[1]) {
      return { type, id: match[1] };
    }
  }

  // URI format: spotify:{type}:{id}
  const uriPatterns: [SpotifyLinkType, RegExp][] = [
    ["track", /spotify:track:([a-zA-Z0-9]+)/],
    ["playlist", /spotify:playlist:([a-zA-Z0-9]+)/],
    ["album", /spotify:album:([a-zA-Z0-9]+)/],
  ];

  for (const [type, pattern] of uriPatterns) {
    const match = link.match(pattern);
    if (match?.[1]) {
      return { type, id: match[1] };
    }
  }

  return null;
}

export async function getPlaylistMetadata(playlistId: string): Promise<Playlist | null> {
  // 1. Try embed page for metadata + accurate track count via partner API
  try {
    const embed = await parseSpotifyEmbedPage(playlistId);
    if (embed) {
      const { entity, accessToken } = embed;
      let trackCount = entity.trackList.length;

      // Get real total from partner API
      try {
        const countResponse = await fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
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
              offset: 0,
              limit: 1,
              includeEpisodeContentRatingsV2: false,
            },
            operationName: "fetchPlaylistContents",
            extensions: {
              persistedQuery: { version: 1, sha256Hash: PARTNER_QUERY_HASH },
            },
          }),
        });

        if (countResponse.ok) {
          const countData = (await countResponse.json()) as PartnerPlaylistResponse;
          const total = countData.data?.playlistV2?.content?.totalCount;
          if (typeof total === "number") trackCount = total;
        }
      } catch {
        // Non-critical - use embed track count as fallback
      }

      const image = entity.coverArt?.sources?.reduce?.((a, b) => (a.width > b.width ? a : b));

      return {
        id: playlistId,
        name: entity.title || entity.name,
        description: entity.description ?? undefined,
        trackCount,
        imageUrl: image?.url ?? undefined,
      };
    }
  } catch (error) {
    console.error(`Embed page metadata failed for ${playlistId}:`, error);
  }

  // 2. Fallback to spotify-url-info
  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getDetails = spotifyUrlInfoModule.getDetails;

    const spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;
    const details = await getDetails(spotifyUrl);

    return {
      id: playlistId,
      name: details.preview.title,
      description: details.preview.description ?? undefined,
      trackCount: details.tracks.length,
      imageUrl: details.preview.image ?? undefined,
    };
  } catch (error) {
    console.error(`Failed to fetch playlist metadata for ${playlistId}:`, error);
    return null;
  }
}

export async function getPlaylistTracks(
  playlistId: string,
  quick?: boolean,
  onFetchProgress?: (current: number, total: number) => void,
): Promise<Song[]> {
  // 1. Try embed page + partner API pagination (gets full track list)
  try {
    const embed = await parseSpotifyEmbedPage(playlistId);
    if (embed) {
      const { entity, accessToken } = embed;
      const tracks = entity.trackList.map(embedTrackToSong);

      if (quick) {
        try {
          const numPages = Math.min(Math.ceil(tracks.length / BATCH_SIZE), 2);
          const limit = numPages * BATCH_SIZE;
          const partnerTracks = await paginateFetch(limit, 0, BATCH_SIZE, CONCURRENCY, (o) =>
            fetchPartnerPage(playlistId, accessToken, o),
          );
          const imageMap = new Map(partnerTracks.map((t) => [t.id, t.albumImageUrl]));
          return tracks.map((t) => ({
            ...t,
            albumImageUrl: imageMap.get(t.id) ?? t.albumImageUrl,
          }));
        } catch {
          return tracks;
        }
      }

      // Fetch ALL tracks from partner API for album art enrichment
      try {
        const countResponse = await fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
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
              offset: 0,
              limit: 1,
              includeEpisodeContentRatingsV2: false,
            },
            operationName: "fetchPlaylistContents",
            extensions: {
              persistedQuery: { version: 1, sha256Hash: PARTNER_QUERY_HASH },
            },
          }),
        });

        if (countResponse.ok) {
          const countData = (await countResponse.json()) as PartnerPlaylistResponse;
          const total = countData.data?.playlistV2?.content?.totalCount;

          if (typeof total === "number" && total > 0) {
            const partnerTracks = await fetchPartnerPlaylistTracks(
              playlistId,
              accessToken,
              0,
              total,
              undefined,
              onFetchProgress,
            );

            const partnerMap = new Map<string, Song>();
            for (const pt of partnerTracks) {
              partnerMap.set(pt.id, pt);
            }
            const merged = tracks.map((t) => {
              const partner = partnerMap.get(t.id);
              if (partner && partner.albumImageUrl) {
                return {
                  ...t,
                  album: partner.album || t.album,
                  albumImageUrl: partner.albumImageUrl,
                };
              }
              return t;
            });
            const embedIds = new Set(tracks.map((t) => t.id));
            for (const pt of partnerTracks) {
              if (!embedIds.has(pt.id)) {
                merged.push(pt);
              }
            }
            return merged;
          }
        }
      } catch {
        // Non-critical - return embed tracks only
      }

      return tracks;
    }
  } catch (error) {
    console.error(`Embed tracks failed for ${playlistId}:`, error);
  }

  // 2. Fallback to spotify-url-info (50-100 tracks)
  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getTracksFromUrl = spotifyUrlInfoModule.getTracks;

    const spotifyUrl = `https://open.spotify.com/playlist/${playlistId}`;
    const tracks = await getTracksFromUrl(spotifyUrl);
    return tracks.map((track) => ({
      id: track.uri.replace("spotify:track:", ""),
      title: track.name,
      artist: track.artist,
      album: "",
      albumImageUrl: undefined,
      previewUrl: track.previewUrl,
      duration: track.duration ?? 0,
    }));
  } catch (error) {
    console.error(`Failed to fetch tracks for playlist ${playlistId}:`, error);
    return [];
  }
}

// ── Track fetchers ────────────────────────────────────────────────────────────

export interface TrackMetadata {
  id: string;
  name: string;
  artist: string;
  albumName: string;
  albumId: string | null;
  imageUrl: string | undefined;
  previewUrl: string | undefined;
  durationMs: number;
}

/** Fetch just the preview URL for a single track (lighter than getTrackMetadata) */
export async function getTrackPreviewUrl(trackId: string): Promise<string | undefined> {
  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getPreview = spotifyUrlInfoModule.getPreview;

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    const preview = await getPreview(spotifyUrl);
    return preview.audio ?? undefined;
  } catch {
    return undefined;
  }
}

/** Fetch metadata for a single track by its Spotify ID */
export async function getTrackMetadata(trackId: string): Promise<TrackMetadata | null> {
  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getDetails = spotifyUrlInfoModule.getDetails;

    const spotifyUrl = `https://open.spotify.com/track/${trackId}`;
    const details = await getDetails(spotifyUrl);

    // For a track URL, details.tracks[0] may have duration info
    const firstTrack = details.tracks[0];

    return {
      id: trackId,
      name: details.preview.title,
      artist: details.preview.artist,
      albumName: "",
      albumId: null,
      imageUrl: details.preview.image ?? undefined,
      previewUrl: details.preview.audio ?? undefined,
      durationMs: firstTrack?.duration ?? 0,
    };
  } catch (error) {
    console.error(`Failed to fetch track metadata for ${trackId}:`, error);
    return null;
  }
}

// ── Album fetchers ────────────────────────────────────────────────────────────

export interface AlbumMetadata {
  id: string;
  name: string;
  artistName: string;
  releaseDate: string | null;
  imageUrl: string | undefined;
  totalTracks: number;
}

/** Fetch metadata for an album by its Spotify ID */
export async function getAlbumMetadata(albumId: string): Promise<AlbumMetadata | null> {
  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getDetails = spotifyUrlInfoModule.getDetails;

    const spotifyUrl = `https://open.spotify.com/album/${albumId}`;
    const details = await getDetails(spotifyUrl);

    return {
      id: albumId,
      name: details.preview.title,
      artistName: details.preview.artist,
      releaseDate: details.preview.date ?? null,
      imageUrl: details.preview.image ?? undefined,
      totalTracks: details.tracks.length,
    };
  } catch (error) {
    console.error(`Failed to fetch album metadata for ${albumId}:`, error);
    return null;
  }
}

/** Fetch all tracks from an album by its Spotify ID */
export async function getAlbumTracks(albumId: string, accessToken?: string): Promise<Song[]> {
  if (accessToken) {
    return fetchPartnerAlbumAllTracks(albumId, accessToken);
  }

  try {
    // Try to get access token from embed page for partner API
    const token = await extractSpotifyEmbedToken("album", albumId);
    if (token) {
      return fetchPartnerAlbumAllTracks(albumId, token);
    }
  } catch {
    // Fall through to spotify-url-info
  }

  try {
    const spotifyUrlInfoModule = spotifyUrlInfo(fetch);
    const getTracksFromUrl = spotifyUrlInfoModule.getTracks;

    const spotifyUrl = `https://open.spotify.com/album/${albumId}`;
    const tracks = await getTracksFromUrl(spotifyUrl);
    return tracks.map((track) => ({
      id: track.uri.replace("spotify:track:", ""),
      title: track.name,
      artist: track.artist,
      album: "",
      albumImageUrl: undefined,
      previewUrl: track.previewUrl,
      duration: track.duration ?? 0,
    }));
  } catch (error) {
    console.error(`Failed to fetch tracks for album ${albumId}:`, error);
    return [];
  }
}
