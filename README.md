# Virtelon

AI-assisted lead discovery, research, scoring, and outreach — internal tool, built to become a multi-tenant product later. Full technical design is in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); this file is just "how do I turn it on."

## One-time setup

You need these installed once: **Node 20+**, **pnpm**, **PostgreSQL**, **Redis**.

```bash
brew install postgresql@16 redis   # if you don't have them yet
brew services start postgresql@16
brew services start redis

pnpm install
cp .env.example apps/web/.env.local   # fill in DATABASE_URL, AUTH_SECRET, AUTH_URL at minimum
cp .env.example packages/db/.env      # same DATABASE_URL here

pnpm db:migrate
pnpm db:seed        # optional — creates a demo org/user
```

Everything else in `.env.example` (Google Places, Anthropic, Google Custom Search) is **optional**. Without them the app still works using free defaults: OpenStreetMap for lead discovery, a clearly-labeled mock for AI drafts.

## Every time you want to use it

Two things need to be running in the background before you start the app:

```bash
brew services start postgresql@16
brew services start redis
```

(If you ran `brew services start` once already, they stay running across reboots — you can skip this most days. `redis-cli ping` should reply `PONG` if it's up.)

Then, from the project root:

```bash
pnpm dev
```

This starts **both** the web app and the background worker at once (the worker is what runs "Automated" campaigns on a schedule — without it, campaigns still work, you just click "Discover" manually).

Open **http://localhost:3000**.

To stop everything, `Ctrl+C` in that terminal.

## What each piece is, in plain terms

- **The web app** (`apps/web`) — the dashboard: leads, campaigns, outreach queue, team, settings.
- **The worker** (`apps/worker`) — a quiet background process. Its only job right now is running "Automated" campaigns on their schedule. If you never turn a campaign to "Automated," you'll never notice it's there.
- **PostgreSQL** — where every lead, campaign, message, and user lives.
- **Redis** — the queue the worker reads from. Free, local, nothing to configure.

## Everyday commands

```bash
pnpm dev            # start web app + worker
pnpm test           # run the test suite
pnpm typecheck      # check for type errors across the whole project
pnpm build          # production build (what would ship)
pnpm db:studio      # visual browser for the database
```
