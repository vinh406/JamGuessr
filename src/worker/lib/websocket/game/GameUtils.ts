import { SCORING } from "../../../../shared/constants";
import { shuffleArray } from "../../../../shared/utils";
import type { Song, SongChoice } from "../../../../shared/types";
import type { LastFMSimilarTrack } from "../../lastfm/client";

export function calculateScore(
  isCorrect: boolean,
  timeTakenMs: number,
  timePerRoundMs: number,
  streak: number,
): number {
  if (!isCorrect) return 0;
  const speedRatio = 1 - timeTakenMs / timePerRoundMs;
  const speedBonus = Math.round(SCORING.MAX_SPEED_BONUS * Math.max(0, speedRatio));
  const streakBonus = streak * SCORING.STREAK_BONUS;
  return SCORING.BASE_POINTS + speedBonus + streakBonus;
}

export function generateChoices(correctSong: Song, allSongs: Song[]): SongChoice[] {
  const wrongSongs = allSongs.filter((s) => s.id !== correctSong.id);
  const shuffled = shuffleArray(wrongSongs);
  const decoys = shuffled.slice(0, 3);

  const choices: SongChoice[] = [
    {
      index: 0,
      title: correctSong.title,
      artist: correctSong.artist,
      albumImageUrl: correctSong.albumImageUrl,
      isCorrect: true,
    },
    ...decoys.map((song, i) => ({
      index: i + 1,
      title: song.title,
      artist: song.artist,
      albumImageUrl: song.albumImageUrl,
      isCorrect: false,
    })),
  ];

  return shuffleArray(choices).map((choice, i) => ({
    ...choice,
    index: i,
  }));
}

export function generateChoicesWithLastFM(
  correctSong: Song,
  allSongs: Song[],
  similarTracksCache: Map<string, LastFMSimilarTrack[]>,
  lastFmApiKey: string | null,
): SongChoice[] {
  if (!lastFmApiKey) {
    return generateChoices(correctSong, allSongs);
  }

  const similarTracks = similarTracksCache.get(correctSong.id) ?? [];
  let decoys: SongChoice[];

  if (similarTracks.length >= 3) {
    const shuffledSimilar = shuffleArray(similarTracks);
    decoys = shuffledSimilar.slice(0, 3).map((track, i) => ({
      index: i + 1,
      title: track.name,
      artist: track.artist,
      albumImageUrl: track.imageUrl ?? undefined,
      isCorrect: false,
    }));
  } else if (similarTracks.length > 0) {
    const wrongSongs = allSongs.filter((s) => s.id !== correctSong.id);
    const shuffled = shuffleArray(wrongSongs);
    const fallbackDecoys = shuffled.slice(0, 3 - similarTracks.length);

    decoys = [
      ...similarTracks.map((track, i) => ({
        index: i + 1,
        title: track.name,
        artist: track.artist,
        albumImageUrl: track.imageUrl ?? undefined,
        isCorrect: false,
      })),
      ...fallbackDecoys.map((song, i) => ({
        index: similarTracks.length + i + 1,
        title: song.title,
        artist: song.artist,
        albumImageUrl: song.albumImageUrl,
        isCorrect: false,
      })),
    ];
  } else {
    decoys = allSongs
      .filter((s) => s.id !== correctSong.id)
      .slice(0, 3)
      .map((song, i) => ({
        index: i + 1,
        title: song.title,
        artist: song.artist,
        albumImageUrl: song.albumImageUrl,
        isCorrect: false,
      }));
  }

  const choices: SongChoice[] = [
    {
      index: 0,
      title: correctSong.title,
      artist: correctSong.artist,
      albumImageUrl: correctSong.albumImageUrl,
      isCorrect: true,
    },
    ...decoys,
  ];

  return shuffleArray(choices).map((choice, i) => ({
    ...choice,
    index: i,
  }));
}
