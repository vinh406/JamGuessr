# Spotiguess Architecture

## Technology Stack

### Backend

- **Runtime**: Cloudflare Workers
- **Framework**: Hono (edge-optimized web framework)
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Cloudflare Hyperdrive (connection pooling)
- **Real-time**: WebSocket with Durable Objects
- **Auth**: better-auth with Spotify OAuth 2.0

### Frontend

- **Framework**: React 19 with TypeScript
- **Routing**: React Router v7
- **Build**: Vite
- **Styling**: Tailwind CSS v4
- **State**: React Context + WebSocket hooks

### External Services

- **Spotify Web API**: Authentication, playlists, track metadata, 30-second previews
- **Last.fm API**: Smart decoy choices using similar tracks data

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Client Layer                                           │
│  ├─ React Frontend (Vite + Tailwind)                  │
│  └─ WebSocket Client (native API)                      │
└─────────────────────────────────────────────────────────┘
                         ↓ HTTP/WS
┌─────────────────────────────────────────────────────────┐
│  Cloudflare Workers                                     │
│  ├─ Hono Backend (API routes)                          │
│  ├─ WebSocket Durable Object (real-time)               │
│  └─ better-auth (Spotify OAuth)                        │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  Database (PostgreSQL via Hyperdrive)                   │
│  ├─ Users & Sessions (better-auth)                     │
│  ├─ Spotify Accounts (OAuth tokens)                    │
│  └─ Game Results (persisted at game end)               │
└─────────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────────┐
│  External APIs                                          │
│  ├─ Spotify Web API (playlists, tracks, previews)      │
│  └─ Last.fm API (similar tracks for decoy choices)     │
└─────────────────────────────────────────────────────────┘
```

## Core Concepts

### Ephemeral State (Durable Objects)

All room and game state is kept **in-memory** during gameplay using Durable Objects. This approach:

- Reduces database load
- Enables real-time updates via WebSocket
- Simplifies state management
- Only persists final results to database

**State Lifecycle:**

```
Room Created → Players Join → Game Starts → Rounds Play → Game Ends → Results Saved
     ↓              ↓              ↓             ↓             ↓            ↓
  In-Memory     In-Memory      In-Memory     In-Memory     In-Memory    Database
```

### Room Management

Rooms are managed entirely in the Durable Object:

- **Room Code**: 8-character shareable code (e.g., "ABC123XYZ")
- **Host**: First player to join becomes host, controls settings and game start
- **Players**: Tracked with ready status, userId, username, avatar
- **Settings**: Configurable rounds, time per round, and audio playback time
- **Playlist**: Selected by host before game starts

### Game Flow

1. **Lobby Phase**
   - Host creates room and shares code
   - Players join via WebSocket
   - Host configures settings and playlist
   - Players mark ready
   - Host starts game

2. **Game Phase**
   - Fetch tracks from selected Spotify playlist
   - Shuffle and select tracks for rounds
   - Generate smart decoy choices (using Last.fm similar tracks when available)
   - Play rounds with song previews
   - Validate guesses in real-time
   - Award points based on speed and streak
   - Show leaderboard after each round

3. **End Phase**
   - Calculate final scores
   - Voting for play again
   - Auto-reset to lobby or continue game
   - (Future: Save results to database)

## Current Implementation Status

### ✅ Implemented

**Backend (Durable Object)**

- WebSocket connection management with hibernation
- Player session tracking (username, userId, host status, ready status, avatar)
- Room settings management (rounds, timePerRound, audioTime)
- Playlist selection with Spotify integration
- Host permission validation
- Real-time message broadcasting
- Game event system with styled notifications
- Room code generation (cryptographically random 8-char codes)
- Game state machine (lobby → starting → playing → roundEnd)
- Round management with countdown timer
- Answer recording and early round end when all players answer
- Scoring system with speed bonus and streak bonus
- Leaderboard updates
- Play again voting system
- Unified room state synchronization for reconnections

**Backend (Spotify Integration)**

- OAuth token management with refresh
- Playlist track fetching
- Preview URL handling

**Backend (Last.fm Integration)**

- Similar tracks fetching for smart decoy choices
- Artist top tracks fallback for decoy generation
- Caching of similar tracks per song

**Frontend (Room Page)**

- Room lobby UI with player list
- Host controls (settings, playlist, start game)
- Player ready toggle
- Real-time updates via WebSocket
- Settings modal (rounds, time per round, audio time)
- Playlist selection modal
- Chat integration
- Game view with countdown timer
- Song choice buttons
- Audio preview with volume control
- Answer submission and feedback
- Round end view with correct answer reveal
- Leaderboard display
- Play again voting UI
- Auto-return to lobby handling

**Frontend (Auth)**

- Spotify OAuth login flow
- Session persistence
- User profile display

**Shared**

- TypeScript types for all WebSocket messages
- Constants for default settings, limits, and scoring
- Room code generation utilities

### 🚧 In Progress

- Database persistence for game results
- Team mode
- Spectator mode

### 📋 Planned Features

**Database**

- Songs table (Spotify track cache)
- Game results table (final scores, winner, songs used)

**Enhanced Features**

- Player statistics and achievements
- Chat history persistence
- Custom playlist blending (top tracks from all players)

## WebSocket Events

### Client → Server

| Event             | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| `join`            | Join a room with username, room code, userId, and optional avatar |
| `leave`           | Leave the current room                                            |
| `chat_message`    | Send a chat message                                               |
| `ready`           | Toggle ready status                                               |
| `update_settings` | Update room settings (host only)                                  |
| `update_playlist` | Update selected playlist (host only)                              |
| `start_game`      | Start the game (host only)                                        |
| `answer`          | Submit an answer choice                                           |
| `vote_play_again` | Vote yes/no to play again                                         |

### Server → Client

| Event                | Description                                  |
| -------------------- | -------------------------------------------- |
| `user_joined`        | Player joined the room                       |
| `user_left`          | Player left the room                         |
| `users_updated`      | Player list changed                          |
| `room_created`       | Room was created (first player)              |
| `unified_room_state` | Full room state for new/reconnecting players |
| `settings_updated`   | Settings were changed                        |
| `playlist_updated`   | Playlist was changed                         |
| `game_event`         | Game lifecycle events (styled notifications) |
| `game_started`       | Game is starting with round info             |
| `round_started`      | New round starting with song and choices     |
| `round_ended`        | Round ended with correct answer and scores   |
| `answer_result`      | Result of player's answer submission         |
| `leaderboard_update` | Updated scores/leaderboard                   |
| `vote_update`        | Vote status update                           |
| `error`              | Error message                                |

## Scoring System

Points are calculated based on:

- **Base Points**: 100 per correct answer
- **Speed Bonus**: Up to 100 extra points based on response time
- **Streak Bonus**: 10 extra points per consecutive correct answer

```
score = BASE_POINTS + speedBonus + (streak * STREAK_BONUS)
speedRatio = 1 - (timeTaken / timePerRound)
speedBonus = MAX_SPEED_BONUS * max(0, speedRatio)
```

## Game Phases

```
lobby → starting → playing → roundEnd → [playing | lobby]
                                ↓
                              lobby (if vote fails or timeout)
                                ↓
                              lobby (if vote succeeds and new game starts)
```

## Database Schema

### Current (Implemented)

```sql
-- Users (better-auth)
user: id, name, email, emailVerified, image, createdAt, updatedAt

-- Sessions (better-auth)
session: id, expiresAt, token, createdAt, updatedAt, ipAddress, userAgent, userId

-- Accounts (better-auth - Spotify OAuth tokens)
account: id, accountId, providerId, userId, accessToken, refreshToken, idToken,
         accessTokenExpiresAt, refreshTokenExpiresAt, scope, password, createdAt, updatedAt

-- Verification (better-auth)
verification: id, identifier, value, expiresAt, createdAt, updatedAt
```

### Planned

```sql
-- Songs (Spotify track cache)
songs: id, spotifyTrackId, title, artist, album, albumArtUrl, previewUrl, durationMs

-- Game Results (persisted at game end)
gameResults: id, roomCode, totalRounds, playerCount, startedAt, completedAt,
             winnerId, winnerName, finalScores (JSONB), songsUsed (JSONB)
```

## Key Design Decisions

1. **Ephemeral State**: Room and game state lives only in Durable Object memory, not in database
2. **WebSocket-First**: All room/game operations via WebSocket, HTTP only for auth and user data
3. **Host Control**: First player to join becomes host, controls settings and game start
4. **Real-time Updates**: All state changes broadcast to room members immediately
5. **Spotify Integration**: Use preview URLs for playback, fetch playlist tracks for gameplay
6. **Smart Decoys**: Last.fm API provides similar tracks for more challenging wrong answers
7. **Unified State**: Single `unified_room_state` message syncs full state for joins/reconnects

## Development Phases

### Phase 1: Core Infrastructure ✅

- Project setup (Vite, React, Hono)
- Cloudflare Workers configuration
- Database with Drizzle ORM
- better-auth with Spotify OAuth

### Phase 2: Room & Lobby ✅

- Durable Object for WebSocket
- Room state management
- Player tracking and ready system
- Settings and playlist configuration
- Real-time updates

### Phase 3: Game Mechanics ✅

- Game state machine implementation
- Round flow with song playback
- Scoring system with speed/streak bonuses
- Leaderboard updates
- Play again voting

### Phase 4: Spotify Integration ✅

- Playlist track fetching
- OAuth token management with refresh
- Preview URL handling
- Song preview playback in game rounds
- (Planned: user's top tracks, blend algorithm, album art display)

### Phase 5: Persistence & Polish 🚧

- Error handling and validation
- Loading states and UX improvements
- 🚧 Database tables for songs and game results
- 🚧 Save game results at end

### Phase 6: Deployment ✅

- Deploy to Cloudflare
- Environment configuration
- Monitoring and logging

## Project Structure

```
spotiguess/
├── src/
│   ├── react-app/                    # Frontend
│   │   ├── components/
│   │   │   ├── common/              # Shared UI components
│   │   │   ├── game/                # Game view components
│   │   │   ├── room/                # Room lobby components
│   │   │   ├── ui/                   # Base UI components
│   │   │   └── Header.tsx
│   │   ├── contexts/
│   │   │   └── AuthContext.tsx       # Auth context provider
│   │   ├── hooks/
│   │   │   ├── room/                # Room-related hooks (useRoomState, useRoomActions)
│   │   │   ├── useAuth.ts           # Auth hook
│   │   │   ├── useGameSocket.ts     # WebSocket hook
│   │   │   ├── useLibraryImport.ts  # Playlist import hook
│   │   │   └── useSSE.ts            # Server-Sent Events hook
│   │   ├── pages/
│   │   │   ├── HomePage.tsx
│   │   │   ├── LoginPage.tsx
│   │   │   ├── RoomPage.tsx
│   │   │   └── LibraryPage.tsx
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── worker/                      # Backend (Hono + Cloudflare Workers)
│   │   ├── db/
│   │   │   └── schema.ts           # Drizzle schema
│   │   ├── handlers/                # WebSocket message handlers
│   │   │   ├── roomHandler.ts
│   │   │   ├── gameHandler.ts
│   │   │   ├── chatHandler.ts
│   │   │   └── index.ts
│   │   ├── lib/
│   │   │   ├── better-auth/         # Auth configuration
│   │   │   ├── lastfm/              # Last.fm API client
│   │   │   ├── library/             # Library management handlers
│   │   │   ├── spotify/             # Spotify API client
│   │   │   ├── sse.ts               # Server-Sent Events utility
│   │   │   └── websocket/
│   │   │       ├── game/            # Game logic modules
│   │   │       │   ├── GameEngine.ts
│   │   │       │   └── GameUtils.ts
│   │   │       ├── broadcast.ts
│   │   │       ├── messageBuilders.ts
│   │   │       ├── roomManager.ts
│   │   │       └── sessionManager.ts
│   │   ├── types/
│   │   │   └── spotify-url-info.d.ts
│   │   ├── index.ts                # Hono app entry point
│   │   ├── playlistImportDO.ts      # Playlist import Durable Object
│   │   └── websocketDurableObject.ts # WebSocket Durable Object
│   └── shared/                      # Shared types and constants
│       ├── types/
│       │   ├── index.ts
│       │   ├── player.ts
│       │   ├── room.ts
│       │   ├── game.ts
│       │   └── messages.ts
│       └── constants.ts
├── drizzle/                         # Database migrations
├── e2e/                             # Playwright E2E tests
├── wrangler.json                    # Cloudflare config
└── package.json
```

## References

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [Durable Objects](https://developers.cloudflare.com/workers/runtime-apis/durable-objects/)
- [better-auth](https://better-auth.com/docs/introduction)
- [Drizzle ORM](https://orm.drizzle.team/docs/overview)
- [Hono](https://hono.dev/docs/)
- [Spotify Web API](https://developer.spotify.com/documentation/web-api/)
- [Last.fm API](https://www.last.fm/api/)
