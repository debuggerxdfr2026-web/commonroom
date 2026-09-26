# Commonroom

Commonroom is a locally runnable social-community MVP: a welcoming feed, people directory, profiles, follows, reactions, comments, notifications, private one-to-one conversations, and image/video posts. It is a **single Next.js + TypeScript application** with same-origin REST API route handlers and PostgreSQL/Prisma persistence. A separate NestJS service, Redis, and Socket.IO are deliberately omitted to keep the MVP easy to run and deploy without claiming realtime infrastructure it does not have.

The interface opens in dark mode and includes a labeled dark/light switch. Its preference persists in the browser; account credentials and session tokens do not. Signed-out visitors can browse a clearly labeled sample preview. Sample accounts and community activity created by the seed are synthetic development data.

## What works

- Account registration, sign-in, sign-out, password hashing with bcrypt, and revocable 14-day sessions in `HttpOnly`, `SameSite=Lax` cookies.
- Authenticated feed and profile editing; post text and locally stored image/video attachments.
- Idempotent like/unlike, comments, follow/unfollow, notifications and mark-all-read.
- Private one-to-one conversations and persisted messages. Open conversations refresh from the REST API every 12 seconds; messages are **not** pushed over a websocket.
- Input validation, same-origin checks on mutations, object-level authorization, safe generated upload filenames, and media type sniffing.
- PostgreSQL migrations, realistic synthetic seed data, API tests, and CI checks.

## Requirements

- Node.js 20.9 or newer (Node 22 LTS recommended)
- npm 10+
- Docker Desktop with Compose, or a PostgreSQL 16 database you manage

## Local setup

1. Copy `.env.example` to `.env`. Keep the development values for a local run; use a unique database password in a shared environment.
2. Start PostgreSQL: `docker compose up -d postgres`
3. Install dependencies: `npm ci`
4. Generate Prisma Client and apply the committed migrations:

   ```sh
   npm run db:generate
   npm run db:deploy
   ```

5. (Optional) Add synthetic accounts, conversations, posts, and activity:

   ```sh
   npm run db:seed
   ```

   The seed creates `demo@commonroom.local` with password `CommonroomDemo!2026` and several synthetic accounts. Use this credential **only in a local development database**; do not seed a public deployment.

6. Start the app: `npm run dev`, then open <http://localhost:3000>. The database readiness endpoint is <http://localhost:3000/api/health>.

To stop the local database, run `docker compose down`. The named Docker volume keeps its data. `docker compose down -v` removes that local database volume.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `APP_ORIGIN` | Exact public origin for mutation `Origin` validation, including scheme and port (for example, `https://community.example.com`). |
| `NODE_ENV` | Next.js runtime mode. Production enables the cookie `Secure` flag. |

No secret is needed for session signing: the server issues a cryptographically random opaque token and stores only its SHA-256 digest. Never add real credentials to `.env.example`.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the app in development mode. |
| `npm run build` / `npm start` | Build and run the production server. |
| `npm run lint` | ESLint checks. |
| `npm run typecheck` | TypeScript check. |
| `npm test` | Run focused API/auth/authorization tests. |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration. |
| `npm run db:deploy` | Apply committed migrations in deployment environments. |
| `npm run db:seed` | Insert synthetic demo data (idempotent for existing sample identities). |
| `npm run db:studio` | Open Prisma Studio. |

## Architecture notes

- `src/app/api/` contains the REST handlers. All social reads require a session except the health endpoint and signed-out preview, which is static browser content.
- `src/lib/auth.ts` creates 32-byte random session tokens, hashes them before persistence, checks expiry, and revokes the row on sign-out. Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production. Passwords are bcrypt-hashed at cost 12.
- Unsafe API methods require an exact configured same-origin `Origin`; browser cookies are same-site and there is no cross-origin API mode.
- Prisma models and the first SQL migration live in `prisma/`. The feed, relationship state, messages, and notifications use PostgreSQL as their source of truth.
- The local media handler accepts PNG/JPEG/WebP and MP4/WebM by inspecting file signatures, rejects files above 10 MB, and writes random names under `storage/uploads/`. Authenticated requests to `/api/media/:filename` serve the file with a fixed content type and `nosniff`. The reverse proxy should also enforce a request-body limit. This filesystem adapter is for a single local server, not a durable or horizontally scaled production media store.

## Security and MVP limitations

This is a useful, runnable MVP, not a hardened social network. It does not include rate limiting, email verification or password reset, account recovery, MFA, moderation/reporting, privacy controls for private accounts, friendship requests, end-to-end encryption, websocket delivery, or a production object-storage adapter. The demo seed credential is public by design. Local uploads are not durable on many serverless platforms. Production should add rate limits and abuse controls, email verification/recovery, moderation, durable object storage with signed upload policies, backups, monitoring, and a reviewed privacy/retention policy before accepting real users. The application does not claim these capabilities.

## Deployment outline

1. Provision PostgreSQL 16+ with TLS, backups, and a restricted application user.
2. Deploy the Next.js app on a persistent Node.js 20.9+ runtime; configure `DATABASE_URL`, `APP_ORIGIN`, and `NODE_ENV=production` in the platform’s secret manager.
3. Run `npm ci`, `npm run db:generate`, and `npm run db:deploy` as a release step. **Do not run the demo seed in production.**
4. Serve only over HTTPS so production session cookies receive the `Secure` attribute. Configure the exact canonical origin in `APP_ORIGIN`.
5. Replace the local disk upload handler with a durable object-storage adapter before using ephemeral or horizontally scaled application hosts. Add operational protections listed above before inviting real users.

## CI

The GitHub Actions workflow runs dependency installation, lint, typecheck, tests, and a production build on pushes and pull requests targeting `main`.
