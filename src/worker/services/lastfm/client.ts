import { LastFMTrack, LastFMArtist } from "lastfm-ts-api";

export interface LastFMSimilarTrack {
  name: string;
  artist: string;
  mbid: string;
  url: string;
  imageUrl: string | null;
}

export async function getSimilarTracks(
  artist: string,
  track: string,
  apiKey: string,
  limit: number = 10,
): Promise<LastFMSimilarTrack[]> {
  try {
    const client = new LastFMTrack(apiKey);
    const artistParts = artist.split(/[,;\u00A0]/);
    const firstArtist = artistParts[0]?.trim() ?? artist;
    const response = await client.getSimilar({
      artist: firstArtist,
      track,
      limit,
    });

    if (!response?.similartracks?.track) {
      return [];
    }

    return response.similartracks.track.map((t) => ({
      name: t.name,
      artist: t.artist.name,
      mbid: t.mbid,
      url: t.url,
      imageUrl:
        t.image.find((img) => img.size === "medium")?.["#text"] ??
        t.image.find((img) => img.size === "large")?.["#text"] ??
        null,
    }));
  } catch (error) {
    console.error("Failed to fetch similar tracks from Last.fm:", error);
    return [];
  }
}

export async function getArtistTopTracks(
  artist: string,
  apiKey: string,
  limit: number = 10,
): Promise<LastFMSimilarTrack[]> {
  try {
    const client = new LastFMArtist(apiKey);
    const artistParts = artist.split(/[,;\u00A0]/);
    const firstArtist = artistParts[0]?.trim() ?? artist;
    const response = await client.getTopTracks({
      artist: firstArtist,
      limit,
    });

    if (!response?.toptracks?.track) {
      return [];
    }

    return response.toptracks.track.map((t) => ({
      name: t.name,
      artist: firstArtist,
      mbid: t.mbid,
      url: t.url,
      imageUrl:
        t.image.find((img) => img.size === "medium")?.["#text"] ??
        t.image.find((img) => img.size === "large")?.["#text"] ??
        null,
    }));
  } catch (error) {
    console.error("Failed to fetch artist top tracks from Last.fm:", error);
    return [];
  }
}
