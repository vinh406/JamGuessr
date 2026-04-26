declare module "spotify-url-info" {
  interface Track {
    artist: string;
    duration?: number;
    name: string;
    previewUrl?: string;
    uri: string;
  }

  interface Preview {
    date: string | null;
    title: string;
    type: string;
    track: string;
    description?: string;
    artist: string;
    image?: string;
    audio?: string;
    link: string;
    embed: string;
  }

  interface Details {
    preview: Preview;
    tracks: Track[];
  }

  interface SpotifyUrlInfo {
    getLink: (data: unknown) => string;
    // Provides the full available data, in a shape that is very similar to what the spotify API returns.
    getData: (url: string, opts?: RequestInit) => Promise<unknown>;
    // Always returns the same fields for different types of resources (album, artist, playlist, track). The preview track is the first in the Album, Playlist, etc.
    getPreview: (url: string, opts?: RequestInit) => Promise<Preview>;
    // Returns array with tracks. This data is passed on straight from spotify, so the shape could change.Only the first 100 tracks will be returned.
    getTracks: (url: string, opts?: RequestInit) => Promise<Track[]>;
    // Returns both the preview and tracks. Should be used if you require information from both of them so that only one request is made.
    getDetails: (url: string, opts?: RequestInit) => Promise<Details>;
  }

  function spotifyUrlInfo(fetch: typeof globalThis.fetch): SpotifyUrlInfo;
  export default spotifyUrlInfo;
}
