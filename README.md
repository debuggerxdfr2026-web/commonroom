# Commonroom

Commonroom is a locally runnable, **guest-only** social app: a welcoming feed, people directory, guest profiles, follows, reactions, comments, notifications, one-to-one conversations, and image/video posts. It is a **single Next.js + TypeScript application** with same-origin REST API route handlers and PostgreSQL/Prisma persistence. A separate NestJS service, Redis, and Socket.IO are deliberately omitted to keep the MVP easy to run and deploy without claiming realtime infrastructure it does not have.

The interface opens in dark mode and includes a labeled dark/light switch. Visitors automatically get an anonymous identity stored in an `HttpOnly`, `SameSite=Lax` browser cookie; no login, registration, email, password, or username input is required. Usernames are generated automatically for social display and are not verified from bootstrap requests. The cookie lasts one year. Clearing or losing it creates a new guest identity, and the previous identity cannot be recovered or transferred to another browser.

## What works

- Automatic anonymous browser identities and guest profile editing; post text and locally stored image/video attachments.
- Idempotent like/unlike, comments, follow/unfollow, notifications and mark-all-read.
- Private one-to-one conversations and persisted messages between currently active guest browsers. Open conversations refresh from the REST API every 12 seconds; messages are **not** pushed over a websocket.
- Input validation (including 16 KB JSON and 10 MB media limits), same-origin checks on mutations, guest-session-scoped data access, safe generated upload filenames, and media type sniffing.
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

5. (Optional) Add synthetic guest profiles, posts, and activity:

   ```sh
   npm run db:seed
   ```

   The seed creates sample guest profiles and community content. It does not create credentials or sign-in accounts. Use it only when synthetic community content is appropriate for the database.

6. Start the app: `npm run dev`, then open <http://localhost:3000>. The database readiness endpoint is <http://localhost:3000/api/health>.

To stop the local database, run `docker compose down`. The named Docker volume keeps its data. `docker compose down -v` removes that local database volume.

## Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
| `APP_ORIGIN` | Exact public origin for mutation `Origin` validation, including scheme and port (for example, `https://community.example.com`). |
| `NODE_ENV` | Next.js runtime mode. Production enables the cookie `Secure` flag. |

No authentication or signing secret is required. The server issues a cryptographically random opaque guest token and stores only its SHA-256 digest. The guest identity is tied to the browser cookie, not a recoverable account.

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Run the app in development mode. |
| `npm run build` / `npm start` | Build and run the production server. |
| `npm run lint` | ESLint checks. |
| `npm run typecheck` | TypeScript check. |
| `npm test` | Run focused guest identity and social API tests. |
| `npm run db:migrate -- --name <name>` | Create and apply a development migration. |
| `npm run db:deploy` | Apply committed migrations in deployment environments. |
| `npm run db:seed` | Insert synthetic guest profiles and community content. |
| `npm run db:studio` | Open Prisma Studio. |

## Architecture notes

- `src/app/api/` contains the REST handlers. `POST /api/guest` bootstraps a guest identity; social operations require its opaque browser cookie.
- `src/lib/guest.ts` creates 32-byte random guest tokens, stores only their SHA-256 digests, and expires them after one year. Cookies are `HttpOnly`, `SameSite=Lax`, `Path=/`, and `Secure` in production.
- Unsafe API methods require an exact configured same-origin `Origin`; browser cookies are same-site and there is no cross-origin API mode.
- Prisma models and SQL migrations live in `prisma/`. The guest profile, feed, relationship state, messages, and notifications use PostgreSQL as their source of truth.
- The local media handler accepts PNG/JPEG/WebP and MP4/WebM by inspecting file signatures, rejects files above 10 MB, and writes random names under `storage/uploads/`. Requests with a guest session to `/api/media/:filename` serve the file with a fixed content type and `nosniff`. The reverse proxy should also enforce a request-body limit. This filesystem adapter is for a single local server, not a durable or horizontally scaled production media store.

## Security and MVP limitations

This is a useful, runnable MVP, not a hardened social network. Guest profiles and their activity are public community data, not private accounts. The app does not include rate limiting, moderation/reporting, identity recovery, private profiles, end-to-end encryption, websocket delivery, or a production object-storage adapter. A browser that loses its cookie cannot recover its profile, posts, follows, conversations, or notifications. The guest cookie is a lightweight browser identity, not proof of a real-world identity, and can be replaced by clearing browser data. Local uploads are not durable on many serverless platforms. Production should add rate limits and abuse controls, moderation, durable object storage with signed upload policies, backups, monitoring, and a reviewed privacy/retention policy before accepting real users.

The guest-only migration removes stored email addresses, password hashes, and prior login sessions while retaining existing profile and social-content rows. Existing account profiles therefore remain as historical community profiles, but their former owners cannot sign in or reclaim them.

## Deployment outline

1. Provision PostgreSQL 16+ with TLS, backups, and a restricted application user.
2. Deploy the Next.js app on a persistent Node.js 20.9+ runtime; configure `DATABASE_URL`, `APP_ORIGIN`, and `NODE_ENV=production` in the platform’s secret manager.
3. Run `npm ci`, `npm run db:generate`, and `npm run db:deploy` as a release step. Decide whether synthetic guest activity is appropriate before running the seed.
4. Serve only over HTTPS so production guest cookies receive the `Secure` attribute. Configure the exact canonical origin in `APP_ORIGIN`.
5. Replace the local disk upload handler with a durable object-storage adapter before using ephemeral or horizontally scaled application hosts. Add operational protections listed above before inviting real users.

## CI

The GitHub Actions workflow runs dependency installation, lint, typecheck, tests, and a production build on pushes and pull requests targeting `main`.
