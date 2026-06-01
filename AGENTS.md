# AGENTS.md — MediChat Beta

## Commands

```bash
pnpm install --frozen-lockfile   # pnpm 10.32.1 required — no npm/yarn
pnpm dev                         # Next.js dev server (port 3000)
pnpm build                       # production build
pnpm lint                        # ESLint (Next.js flat config)
pnpm db:push                     # push schema directly to PostgreSQL (no migrate runner)
pnpm db:generate                 # generate Drizzle Kit migrations into ./drizzle/
```

- **No `test` or `typecheck` scripts exist.** `tsc --noEmit` is not wired.
- `db:push` is the only way to apply schema — Drizzle migrations in `./drizzle/` exist but there is no migrate command.

## Environment

Copy `.env.example` → `.env.local`. Key vars beyond the obvious:

| Var | Note |
|-----|------|
| `AI_MODEL_CHAT` | Primary chat model (default `openai/gpt-4o`) |
| `AI_MODEL_EXTRACT` | Document extraction model (default `openai/gpt-4o-mini`) |
| `AI_MODEL_DASHBOARD` | Daily dashboard generation model |
| `AI_API_BASE` | Defaults to OpenRouter `https://openrouter.ai/api/v1` |
| `SUPABASE_BUCKET_ENDPOINT` | Storage is **Supabase S3-compatible**, not AWS S3 |

## Architecture

- **Single package** Next.js 16 App Router app. No monorepo.
- **Path alias**: `@/*` → `./src/*` (only one alias).

### Auth & Routing

- **Middleware** is `src/proxy.ts` (misleading name — it is Clerk middleware, not a proxy). Public routes: `/auth*`, `/api/webhooks/clerk`, `/monitoring*`. Everything else requires `auth.protect()`.
- **Route group**: `(authed)` wraps all protected routes with an auth guard layout.
- **Dual-mode**: cookie `medichat_mode` = `patient` or `physician`. Set client-side, read server-side. `medichat_theme` = `dark` or `light`.
- Active users live in the `users` table — populated by Clerk webhook (`user.created`), NOT by app logic.

### AI Pipeline

- Chat at `POST /api/chat` — **SSE streaming** with tool loop (max 3 iterations).
- Four AI tools registered: `retrieveMemories`, `logMemory`, `getDocumentInsights`, `proposePatientRecordSuggestion`.
- Voice: STT via `faster-whisper-server`, TTS via `kokoro-fastapi` — both Docker services, proxied through `/api/voice/transcribe` and `/api/voice/speak`.
- Document upload → S3 → extract text (`pdf-parse` or UTF-8) → AI structured extraction (Zod schema) → ingest into patient tables in a transaction.

### Database

- PostgreSQL via Drizzle ORM. Schema at `src/server/db/schema.ts`.
- All DB code is server-only — lives in `src/server/`.

### Conventions

- **All `src/server/` code runs exclusively on the server** (Node.js runtime). Never import from it in client components.
- **API routes use Zod** for input validation and return typed error responses (`UNAUTHENTICATED`, `FORBIDDEN_PATIENT_ACCESS`, `DATABASE_NOT_AVAILABLE`).
- `"use client"` boundary on: `ClientProviders`, `AppShell`, `ChatPanel`, all feature components, `useVoice`.
- **UI primitives** at `src/components/ui/` are custom (not shadcn). No barrel export — import each individually.
- **Error name pattern**: API errors use `name` discriminator (e.g. `name: "UNAUTHENTICATED"`) rather than HTTP status codes alone.

## Docker

- `output: "standalone"` in `next.config.ts`.
- `serverExternalPackages: ["pino", "pino-pretty", "thread-stream"]` — native modules must not be bundled.
- Dockerfile sets **dummy `DATABASE_URL`** during build so Next.js doesn't crash (it tries to connect during static analysis).