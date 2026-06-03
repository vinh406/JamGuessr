# Spotiguess

Multiplayer Spotify song guessing game on Cloudflare Workers.

## Commands

| Command               | Purpose                                |
| --------------------- | -------------------------------------- |
| `npm run dev`         | Local dev server (Vite)                |
| `npm run build`       | Type-check + build                     |
| `npm run check`       | Type-check + build + dry-run deploy    |
| `npm run deploy`      | Deploy to Cloudflare                   |
| `npm run preview`     | Build + preview via `wrangler dev`     |
| `npm run lint`        | oxlint lint                            |
| `npm run fmt`         | oxfmt format                           |
| `npm run cf-typegen`  | Regenerate `worker-configuration.d.ts` |
| `npm run db:generate` | Drizzle schema → SQL migration         |
| `npm run db:migrate`  | Apply pending migrations               |
| `npm run db:push`     | Push schema (dev)                      |
| `npx playwright test` | Run E2E tests                          |

Run `cf-typegen` after changing wrangler.json bindings.

## Architecture

- **Frontend**: `src/react-app/` — React 19 + Tailwind CSS v4 + React Router v7
- **Backend**: `src/worker/` — Hono on Cloudflare Workers
- **Shared**: `src/shared/` — types, constants, validation (imported by both)
- **SPA hosting**: Cloudflare Workers assets with SPA fallback (`not_found_handling: "single-page-application"`). Worker handles `/docs`, `/api/*`, `/ws/*` first
- **API docs**: OpenAPI spec + Scalar UI at `/docs`
- **DB**: PostgreSQL via Cloudflare Hyperdrive + Drizzle ORM. Schema in `src/worker/db/schema.ts`, migrations in `drizzle/`
- **Auth**: better-auth with Spotify OAuth
- **Real-time**: WebSocket → Durable Object (`WebSocketHibernationServer`) at `/ws/:room?`. All room/game state ephemeral in DO memory, only final results persisted to DB
- **Durable Objects**: `src/worker/durable-objects/` — `WebSocketHibernationServer` (game rooms), `PlaylistImportDO` (playlist import)
- **WebSocket layer**: All WS code in `src/worker/ws/` — message routing, game engine, room/ session management
- **Domain services**: `src/worker/services/` — Spotify, Last.fm, better-auth, library, SSE
- **Route handlers**: `src/worker/routes/` — HTTP API route modules (e.g., library)

## Key Conventions

- TypeScript strict mode with `noUncheckedIndexedAccess`, `noImplicitReturns`, `noPropertyAccessFromIndexSignature` — access arrays/objects via optional chaining, not bare indexing
- oxlint for linting (TS + React plugins, `no-explicit-any` is error)
- oxfmt for formatting (run `npm run fmt` before committing)
- No test runner in package.json — E2E via Playwright (`e2e/spotiguess.spec.ts`)
- `.env` required for local dev; copy `.env.example` for reference
