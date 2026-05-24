// Shared constants for the application

import type { RoomSettings } from "./types";

// ============================================================================
// Default Room Settings
// ============================================================================

export const DEFAULT_ROOM_SETTINGS: RoomSettings = {
  rounds: 10,
  timePerRound: 10000, // 10 seconds in milliseconds
  audioTime: 10000, // 10 seconds in milliseconds
};

// ============================================================================
// Settings Validation Limits
// ============================================================================

export const SETTINGS_LIMITS = {
  rounds: { min: 1, max: 50 },
  timePerRound: { min: 5000, max: 30000 }, // 5-30 seconds
  audioTime: { min: 1000, max: 15000 }, // 1-15 seconds
} as const;

// ============================================================================
// Game Settings Options
// ============================================================================

export const ROUND_OPTIONS = [5, 10, 15, 20] as const;
export const TIME_PER_ROUND_OPTIONS = [5, 10, 15, 20, 30] as const;
export const AUDIO_TIME_OPTIONS = [1, 3, 5, 10, 15] as const;

// ============================================================================
// Room Code Generation
// ============================================================================

export const ROOM_CODE_LENGTH = 8;
const ROOM_CODE_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

/**
 * Generates a cryptographically random room code.
 * Uses crypto.getRandomValues for uniform distribution.
 * 8 chars from 36-char alphabet = 36^8 ≈ 2.8 trillion combinations,
 * making collisions negligible in practice.
 */
export function generateRoomCode(): string {
  const bytes = new Uint8Array(ROOM_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ROOM_CODE_CHARS[b % ROOM_CODE_CHARS.length]).join("");
}

// ============================================================================
// Input Validation
// ============================================================================

export const MAX_USERNAME_LENGTH = 20;
export const MAX_CHAT_MESSAGE_LENGTH = 500;
export const ROOM_CODE_REGEX = /^[A-Z0-9]+$/;

// ============================================================================
// Scoring Constants
// ============================================================================

export const SCORING = {
  BASE_POINTS: 100,
  MAX_SPEED_BONUS: 100,
  STREAK_BONUS: 10,
  ROUND_END_DELAY: 5000,
  EARLY_ROUND_END_DELAY: 5000,
  VOTE_DURATION: 30000,
} as const;
