# P08 — School Result Processing and GPA Engine

A deterministic engine that turns raw subject marks into a publishable result
sheet: a grade point per subject, a GPA and letter per student, a full
calculation trace, and the three office checking lists — run against the
real supplied dataset (25 cases, 1,765 students).

Full spec: [`docs/spec.md`](docs/spec.md) · Rule card: [`docs/rules.md`](docs/rules.md) ·
Plan: [`tasks/plan.md`](tasks/plan.md) · Tasks: [`tasks/todo.md`](tasks/todo.md) ·
Third-party licenses: [`LICENSES.md`](LICENSES.md)

## Stack

- **`backend`** — the engine (`src/engine/`, zero-dependency pure integer arithmetic) plus the server: `node:http` only, no web framework. Serves the JSON API. One runtime dependency: `pg`, used only by `src/db.ts` — nothing the engine touches.
- **`frontend`** — React 19 + Vite 8 + Tailwind v4 + shadcn/base-ui, served in production by a dependency-free `node:http` static server (`server.mjs`).
- **Database** — PostgreSQL via a `DATABASE_URL` connection string. **Optional** (see below).
- Node ≥ 20, TypeScript `strict`.

**Two independent apps, not a monorepo.** `backend/` and `frontend/` each have
their own `package.json`, their own lockfile and their own `Dockerfile`, and
neither depends on the other at install time. They deploy as two containers.
The one thing they share — the grading engine — is vendored rather than linked;
see [Sharing the engine](#sharing-the-engine).

Dependency-light by design: the grading rules must be auditable, and nobody
should have to trust a transitive dependency to believe a GPA. See
`docs/spec.md` → *Tech Stack* for the full reasoning.

## Run it

Two terminals, one per app:

```bash
cd backend  && pnpm install && pnpm run dev    # api on :3000
cd frontend && pnpm install && pnpm run dev    # web on :5173
```

Open http://localhost:5173 — Vite proxies `/api` to `:3000`.

### Configuration

In **local development** nothing needs configuring: Vite proxies `/api` to the
backend on `:3000`, so the app talks to it same-origin.

In a **deployed split** the two apps are on two domains, so two variables matter:

| Set on | Variable | Value |
|---|---|---|
| frontend | `API_URL` | the backend's public URL, e.g. `https://api.example.com` |
| backend | `CORS_ORIGIN` | the frontend's public URL, e.g. `https://results.example.com` |

`API_URL` is a **runtime** setting, not a build arg: `server.mjs` renders it into
`/env.js` on every request, so one built image points at any backend and changing
it needs only a restart. (`VITE_API_URL` still exists as a build-time fallback for
static hosts that can't run `server.mjs`.)

Settings live in `.env` files, copied from the committed examples:

```bash
cp backend/.env.example backend/.env      # DATABASE_URL etc.
cp frontend/.env.example frontend/.env    # usually needs nothing
```

`backend/.env` is read automatically at startup by a small built-in loader (no
`dotenv` dependency). **Real environment variables always win** over the file, so
the same image runs locally from the file and on Dokploy from the platform's
injected variables — and `.env` is excluded from the Docker image entirely. The
startup log lists which keys came from the file *by name only*, never their
values, so a connection string with a password can't leak into a deploy log.

### Sharing the engine

The Calculator page evaluates marks in the browser with the *same* engine the
server runs, so the live preview cannot drift from the published result. With no
workspace to link through, `frontend/src/engine/` holds a **generated copy** of
`backend/src/engine/` — the backend's is the source of truth, and one script
owns the copy:

```bash
node scripts/sync-engine.mjs           # refresh the copy after editing the engine
node scripts/sync-engine.mjs --check   # exit 1 if it has drifted — run this in CI
```

Every vendored file carries a `GENERATED FILE — do not edit` banner. Edit
`backend/src/engine/`, re-run the script, and the frontend's typecheck will fail
loudly if you forget.

### With a database (optional)

Saving calculations and recording who hand-checked each student need PostgreSQL.
Everything else — grading, traces, checking lists, and the calculator itself —
works without one.

```bash
docker run -d --name p08-pg -e POSTGRES_USER=p08 -e POSTGRES_PASSWORD=p08 \
  -e POSTGRES_DB=p08 -p 5432:5432 postgres:16-alpine
# If you already run PostgreSQL natively it owns 5432 and will silently win for
# `localhost` — publish on another port (e.g. -p 55432:5432) and adjust the URL.

cd backend
DATABASE_URL=postgres://p08:p08@localhost:5432/p08 pnpm run dev
```

The schema is created automatically on boot. `GET /api/health` reports
`database: connected | not configured | error`, and the UI hides the
database-backed controls with an explanation when there is none.

Or bring everything up together: `docker compose up --build` — db, API and UI.
Compose publishes PostgreSQL on host port **55432** (not 5432) so it cannot
collide with a natively-installed PostgreSQL; containers still reach it as
`db:5432`.

## Commands

Run from inside `backend/` or `frontend/` — there is no root package.

```bash
# backend/
pnpm install
pnpm run dev          # tsx watch, api on :3000
pnpm run build        # engine + server -> dist/
pnpm start            # node dist/server.js
pnpm test             # engine + server tests (node:test); builds first
pnpm run typecheck
pnpm run export       # write output/ artifacts for judging
pnpm run docker:build && pnpm run docker:run

# frontend/
pnpm install
pnpm run dev          # vite, web on :5173
pnpm run build        # tsc -b && vite build -> dist/
pnpm start            # node server.mjs, serves dist/ on :8080
pnpm run lint
pnpm run typecheck
pnpm run docker:build && pnpm run docker:run

# repo root
node scripts/sync-engine.mjs --check     # engine copy is in sync
docker compose up --build                # db + backend + frontend together
```

Database tests run only when a connection string is present, so `pnpm test`
stays green without Postgres:

```bash
cd backend && TEST_DATABASE_URL=postgres://p08:p08@localhost:55432/p08 pnpm test   # compose db
```

Focused test runs while working:

```bash
cd backend
pnpm run build
node --test dist/engine/gpa.test.js                        # one engine rule file
node --test $(ls dist/*.test.js dist/engine/*.test.js)     # everything
```

## What each deliverable is

| Brief | Where |
|---|---|
| **D1** ≥60 students, 2 classes, 6+1 subjects, ≥8 hard-edge students | **Audit** page in the UI, backed by `GET /api/cases/:id/audit` — proves it per case rather than asserting it, and names the candidates standing on each hard edge; see `backend/src/engine/audit.ts` |
| **D2** grade point per subject → GPA → letter | `backend/src/engine/grade.ts`, `gpa.ts` |
| **D3** per-student trace naming the mark, grade point and deciding rule | **Student trace** page in the UI; `traces.txt` in the export |
| **D4** office checking lists (optional / practical-fail / absent) | **Checking lists** page; `GET /api/cases/:id/checklists` — with per-student hand-check sign-off recorded in the database |

Beyond the brief, the **Calculator** page takes a typed-in mark sheet and shows
each rule firing as you type: per-subject grade point and rule id, the R-13
working, the cap, the cancellation, and the letter. It computes in the browser
with the *same* engine the server runs (a generated copy of it — see
[Sharing the engine](#sharing-the-engine)), so the live preview cannot
drift from the published result — and saving re-evaluates server-side, so a
stored row can never disagree with the engine.

Every one of the aggregate figures below was computed by this engine over the
real dataset and is pinned as an exact assertion in
`backend/src/engine/invariants.test.ts`:

525 students cancelled by a compulsory failure · 268 hit the 5.00 cap before
cancellation · 886 have their GPA moved by the optional rule · 305 fail a
practical while passing theory · 25 are absent in their optional subject ·
301 land on more than one checking list.

## Assumptions the brief leaves open

The brief fixes the pass marks and letter bands but never the per-subject
mark → grade-point scale, and doesn't say how a subject with no practical
part is marked. Both are declared, isolated to one file
(`backend/src/engine/rules.ts`), and shown in the app's **Rules** page and in
[`docs/rules.md`](docs/rules.md) with a `source: declared` tag so they're
never mistaken for something the brief actually said. Six more (rounding,
cap-before-cancellation, the absent-optional edge case, …) are documented in
`docs/spec.md` as A1–A8.

## Project structure

```
docs/spec.md                 Full spec: objective, acceptance criteria, API contract
docs/rules.md                Rule card
tasks/plan.md, tasks/todo.md Implementation plan and task checklist
scripts/sync-engine.mjs      Copies backend/src/engine -> frontend/src/engine
docker-compose.yml           Local: db (host :55432) + backend + frontend

backend/                Standalone app — own package.json, lockfile, Dockerfile
  data/                 Supplied dataset (read-only)
  src/engine/           the grading engine, dependency-free: types, rules, format,
                        grade, gpa, engine, checklists, summary, audit  <- SOURCE OF TRUTH
  src/                  dataset (load+validate+evaluate+cache), db (postgres), routes,
                        server (node:http), env, export
  output/               pnpm run export writes here (git-ignored)

frontend/               Standalone app — own package.json, lockfile, Dockerfile
  src/engine/           generated copy of backend/src/engine (do not edit)
  src/                  api client, app shell, pages (overview/calculator/trace/checklists/rules)
  server.mjs            production static server + runtime /env.js
```

## Docker / hosting

**Two images, each built from its own directory.** Both are multi-stage, run as
a non-root user and carry a `HEALTHCHECK` that drives Dokploy's rollout status.

- `backend/Dockerfile` → `node dist/server.js` on `$PORT` (default `3000`),
  JSON API under `/api`, healthcheck `/api/health`. The dataset ships inside
  the image at `data/`.
- `frontend/Dockerfile` → `node server.mjs` on `$PORT` (default `8080`), serves
  the built bundle with SPA fallback, healthcheck `/healthz`. Fingerprinted
  assets are cached immutably; `index.html` and `/env.js` never are.

```bash
docker compose up --build      # db + backend + frontend -> :8080 and :3000
```

### Dokploy

Create **three services** from this repo. Neither app's build context is the
repo root — each one is its own directory, so point Dokploy at it:

| Service | Docker context | Dockerfile | Port |
|---|---|---|---|
| `postgres` | Dokploy's own PostgreSQL service | — | 5432 |
| `backend` | `./backend` | `Dockerfile` | 3000 |
| `frontend` | `./frontend` | `Dockerfile` | 8080 |

Then set the variables. The two apps find each other **only** through these —
get them wrong and the UI loads but every request fails CORS:

| Service | Env var | Default | Purpose |
|---|---|---|---|
| backend | `PORT` | `3000` | Port to listen on |
| backend | `DATABASE_URL` | — | PostgreSQL connection string; unset disables persistence |
| backend | `CORS_ORIGIN` | — | **Required.** The frontend's public URL. Comma-separated for several; `*` allows any |
| backend | `DATABASE_SSL` | `false` | Force TLS when the URL has no `sslmode` |
| backend | `DATA_FILE` | bundled `data/` | Path to the dataset JSON |
| frontend | `PORT` | `8080` | Port to listen on |
| frontend | `API_URL` | — | **Required.** The backend's public URL. Read at runtime — no rebuild to change |

The database schema is created on first boot. Leave `DATABASE_URL` unset and the
backend still deploys and serves every graded result — only saving and sign-off
are unavailable. Add `?sslmode=require` (or set `DATABASE_SSL=true`) if the
provider needs TLS.
