import { getSpotifyClientForUser } from "./client";
import type { Playlist, Song } from "../../../shared/types";
import spotifyUrlInfo from "spotify-url-info";

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

export async function getCurrentUserPlaylists(userId: string, env: Env): Promise<Playlist[]> {
  const playlists: Playlist[] = [];
  const api = await getSpotifyClientForUser(userId, env);

  if (!api) {
    console.error("Failed to get Spotify client for user:", userId);
    return playlists;
  }

  try {
    const result = await api.currentUser.playlists.playlists();

    for (const playlist of result.items ?? []) {
      if (!playlist) continue;
      playlists.push({
        id: playlist.id,
        name: playlist.name,
        description: playlist.description ?? undefined,
        trackCount: (playlist as { items?: { total?: number } }).items?.total ?? 0,
        imageUrl: playlist.images[0]?.url ?? undefined,
      });
    }
  } catch (error) {
    console.error("Failed to fetch current user's playlists:", error);
  }

  return playlists;
}

export async function getPlaylistTracks(playlistId: string): Promise<Song[]> {
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
export async function getAlbumTracks(albumId: string): Promise<Song[]> {
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
