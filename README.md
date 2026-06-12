# JamGuessr

JamGuessr is a multiplayer Spotify song guessing game where players compete to identify songs from a playlist. Players earn points based on correctness and speed, with the fastest and most accurate players climbing the leaderboard.

## 🌐 Demo

Check out the live demo: [JamGuessr Demo](https://jamguessr.vinhnguyenthanh-dev.workers.dev/)

## 🚀 Quick Start

### Installation

```bash
npm install
```

### Development

Start the development server:

```bash
npm run dev
```

Your application will be available at [http://127.0.0.1:5173](http://127.0.0.1:5173).

### Production Build

Build for production:

```bash
npm run build
```

Preview the build locally:

```bash
npm run preview
```

Deploy to Cloudflare Workers:

```bash
npm run build && npm run deploy
```

## 🎮 How to Play

1. **Create or Join a Room**: The host creates a room and shares the 8-character code with friends.
2. **Configure Settings**: The host selects a playlist and sets game parameters (rounds, time per round, audio duration).
3. **Mark Ready**: All players mark themselves as ready.
4. **Game Begins**: Players listen to 10-second song previews and guess the correct track from multiple choices.
5. **Scoring**: Points are awarded based on:
   - Base points (100 per correct answer)
   - Speed bonus (up to 100 extra points)
   - Streak bonus (10 extra points per consecutive correct answer)
6. **Leaderboard**: After each round, players see updated scores and rankings.
7. **Play Again**: After the game ends, players can vote to play again with the same room, or return to the lobby.

# Architechture

See [ARCHITECTURE.md](ARCHITECTURE.md) for details on the system architecture and design decisions.
