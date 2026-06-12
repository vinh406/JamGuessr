import { useState, useRef, useCallback, useEffect } from "react";
import type { SongChoice } from "../../../shared/types";
import { CountdownTimer } from "./CountdownTimer";
import { Slider, Button } from "../ui";

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>(undefined);
  useEffect(() => {
    ref.current = value;
  }, [value]);
  return ref.current;
}

const STORAGE_KEY = "jamguessr-volume";

// Get initial volume from localStorage or default to 50
function getInitialVolume(): number {
  if (typeof window === "undefined") return 50;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored !== null) {
    const parsed = Number(stored);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) return parsed;
  }
  return 50;
}

interface GameViewProps {
  round: number;
  totalRounds: number;
  song: { previewUrl?: string; albumImageUrl?: string };
  choices: SongChoice[];
  endTime: number;
  duration: number; // in milliseconds
  audioTime: number; // in milliseconds
  hasAnswered: boolean;
  selectedChoice: number | null;
  lastAnswerCorrect: boolean | null;
  lastAnswerPoints: number;
  myScore: number;
  myStreak: number;
  onAnswer: (choiceIndex: number) => void;
}

export function GameView({
  round,
  totalRounds,
  song,
  choices,
  endTime,
  duration,
  audioTime,
  hasAnswered,
  selectedChoice,
  lastAnswerCorrect,
  lastAnswerPoints,
  myScore,
  myStreak,
  onAnswer,
}: GameViewProps) {
  const [volume, setVolume] = useState(getInitialVolume);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    let stopAudioTimeout: ReturnType<typeof setTimeout> | undefined;

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (song.previewUrl) {
      const elapsed = Date.now() - (endTime - duration);
      const seekTime = Math.min(elapsed, audioTime);
      const remainingTime = Math.max(0, audioTime - seekTime);

      const audio = new Audio(song.previewUrl);
      audioRef.current = audio;

      if (seekTime > 500) {
        audio.addEventListener(
          "loadedmetadata",
          () => {
            audio.currentTime = seekTime / 1000;
          },
          { once: true },
        );
      }

      if (remainingTime > 0) {
        audio.play().catch(() => {});

        stopAudioTimeout = setTimeout(() => {
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
          }
        }, remainingTime);
      }
    }

    return () => {
      if (stopAudioTimeout) clearTimeout(stopAudioTimeout);
    };
  }, [song.previewUrl, audioTime, endTime, duration]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Cleanup: stop audio when component unmounts (round ends or user leaves)
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
      }
    };
  }, []);

  const [resultPulse, setResultPulse] = useState(false);
  const [scorePulse, setScorePulse] = useState(false);
  const prevCorrect = usePrevious(lastAnswerCorrect);
  const prevScore = usePrevious(myScore);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  useEffect(() => {
    if (prevCorrect === null && lastAnswerCorrect !== null && !prefersReducedMotion) {
      setResultPulse(true);
      const timer = setTimeout(() => setResultPulse(false), 500);
      return () => clearTimeout(timer);
    }
    return;
  }, [lastAnswerCorrect, prevCorrect, prefersReducedMotion]);

  const [showPointsEarned, setShowPointsEarned] = useState(false);

  useEffect(() => {
    if (prevScore !== undefined && myScore > prevScore && !prefersReducedMotion) {
      setScorePulse(true);
      const timer = setTimeout(() => setScorePulse(false), 400);
      return () => clearTimeout(timer);
    }
    return;
  }, [myScore, prevScore, prefersReducedMotion]);

  useEffect(() => {
    if (prevCorrect === null && lastAnswerCorrect !== null && !prefersReducedMotion) {
      setShowPointsEarned(true);
      const timer = setTimeout(() => setShowPointsEarned(false), 4000);
      return () => clearTimeout(timer);
    }
    return;
  }, [lastAnswerCorrect, prevCorrect, prefersReducedMotion]);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    localStorage.setItem(STORAGE_KEY, String(newVolume));
  }, []);

  const handleChoice = useCallback(
    (index: number) => {
      if (!hasAnswered) {
        onAnswer(index);
      }
    },
    [hasAnswered, onAnswer],
  );

  const handleTimeUp = useCallback(() => {}, []);

  return (
    <div className="h-full flex flex-col">
      {/* Compact Header with Timer */}
      <div className="shrink-0 border-b border-gray-700/50">
        <div className="flex items-center justify-between px-3 sm:px-4 py-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xs">
                {round}/{totalRounds}
              </span>
            </div>
            <div className="hidden sm:block">
              <h3 className="text-sm font-semibold text-white">Round {round}</h3>
              <p className="text-xs text-gray-400">of {totalRounds} rounds</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {myStreak > 0 && (
              <div className="px-2 py-0.5 bg-yellow-500/20 rounded-full">
                <span className="text-xs font-semibold text-yellow-400">🔥 {myStreak}</span>
              </div>
            )}
            <div className="relative">
              <div
                className={`px-2 py-0.5 bg-green-500/20 rounded-full ${scorePulse ? "animate-score-pop" : ""}`}
              >
                <span className="text-xs font-semibold text-green-400">{myScore} pts</span>
              </div>
              {showPointsEarned && (
                <span
                  className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-xs font-bold pointer-events-none animate-points-fade ${lastAnswerCorrect ? "text-green-400" : "text-red-400"}`}
                >
                  {lastAnswerCorrect ? `+${lastAnswerPoints}` : "+0"}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="px-3 sm:px-4 pb-2">
          <CountdownTimer endTime={endTime} timePerRound={duration} onTimeUp={handleTimeUp} />
        </div>
      </div>

      {/* Main Content - Centered and Responsive */}
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center px-3 sm:px-4 py-3 sm:py-4 gap-3 sm:gap-4">
        {/* Volume Slider */}
        <div className="flex items-center gap-3 w-full max-w-xs">
          <svg className="w-5 h-5 text-gray-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
            {volume === 0 ? (
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            ) : volume < 50 ? (
              <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
            ) : (
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            )}
          </svg>
          <Slider
            min={0}
            max={100}
            value={volume}
            onChange={handleVolumeChange}
            className="flex-1"
          />
          <span className="text-xs text-gray-400 w-8 text-right">{volume}%</span>
        </div>

        {/* Status Text */}
        <p className="text-gray-400 text-xs sm:text-sm text-center">
          {hasAnswered ? "Waiting for other players..." : "Guess the song!"}
        </p>

        {/* Answer Choices - 2 columns on wider screens */}
        <div className="w-full max-w-lg grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
          {choices.map((choice) => {
            const isSelected = selectedChoice === choice.index;
            return (
              <Button
                variant="ghost"
                key={choice.index}
                onClick={() => handleChoice(choice.index)}
                disabled={hasAnswered}
                className={`w-full text-left transition-all duration-200 ease-out ${
                  hasAnswered
                    ? isSelected
                      ? lastAnswerCorrect
                        ? "bg-green-500/30 border-2 border-green-500"
                        : "bg-red-500/30 border-2 border-red-500"
                      : "bg-gray-700/30 border-2 border-gray-600 opacity-50"
                    : isSelected
                      ? "bg-green-500/40 border-2 border-green-400"
                      : "bg-gray-700/50 border-2 border-gray-600 hover:border-green-500/50 hover:bg-gray-700/70"
                } ${isSelected && resultPulse ? "animate-result-pulse" : ""} ${
                  isSelected && resultPulse
                    ? lastAnswerCorrect
                      ? "shadow-[0_0_20px_-4px_rgba(74,222,128,0.4)]"
                      : "shadow-[0_0_20px_-4px_rgba(248,113,113,0.4)]"
                    : ""
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  <div
                    className={`shrink-0 w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ease-out ${
                      isSelected
                        ? lastAnswerCorrect === false
                          ? "bg-red-500 text-white"
                          : "bg-green-500 text-white"
                        : "bg-gray-600 text-gray-300"
                    } ${isSelected && resultPulse ? "animate-result-pulse" : ""}`}
                  >
                    {choice.index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-white truncate">
                      {choice.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{choice.artist}</p>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
