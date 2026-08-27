# Frontend Modern Contact Management with QR-Powered Networking

<img width="1899" height="987" alt="image" src="https://github.com/user-attachments/assets/a46ff084-f321-4836-8366-5c42a9c7c7f4" />

Front end for the [Contacts API](https://github.com/Rikinshah787/sf-backend) — browse,
search, sort, page through, create, edit, and delete contacts.

Next.js 16 (App Router) · TypeScript · Tailwind CSS · Zod · Jest + Testing Library
+ MSW · Playwright.

## Highlights

Beyond the CRUD basics:

- **Contact photos** — a drag-and-drop picker with live *Preparing photo…*
  feedback, filename-and-size summary, a 1 MB cap and a strict bitmap allowlist
  (SVG is scriptable, so it never gets in). Contacts without a photo get an
  initials avatar whose colour is derived from their email — stable per person,
  in both themes.
- **Multiple addresses** — up to 10 per contact, each tagged Home / Work /
  Other, edited as repeating rows that survive validation round-trips.
- **Save to phone** — every detail page renders a QR code whose payload *is*
  the contact's vCard 3.0 (RFC 2426: escaped, 75-octet folded, UTF-8 safe), so
  any phone camera saves it straight to contacts — no server round trip. The
  `.vcf` download carries the photo too.
- **My card** (`/my-card`) — the other direction: your own scannable card for
  events. Type your details once; LinkedIn rides along as a `URL` property and
  the venue as a `NOTE: Met at …`, all generated client-side. Save the QR as a
  PNG and keep it in your photo library.
- **A form that stays out of the way** — field groups as cards, a sticky
  save bar that never scrolls out of reach, URL-held list state (search, sort,
  pagination survive reload and are shareable), and everything works before
  hydration because submits are real form POSTs.

## Requirements

- Node 20.9+ (Next.js 16's engine floor)
- The [Contacts API](https://github.com/Rikinshah787/sf-backend) running somewhere reachable

## Getting started

```bash
npm install
npx playwright install              # once, for e2e browsers
cp .env.local.example .env.local    # then set API_BASE_URL
npm run dev                         # http://localhost:3000 -> /contacts
```

The backend must be running (default `http://127.0.0.1:8000`). If it is not, the
list page says so rather than blowing up, and the header badge shows
`api unreachable`.

### Try it in 60 seconds

1. Open `/contacts` — the badge should read `api ok · sqlite`.
2. **New contact** → drop a photo onto the dashed zone, add a couple of typed
   addresses, hit the sticky **Create contact**.
3. Open the contact you just made → point your phone camera at the
   **Save to phone** QR — your phone offers to add them, addresses included.
4. Visit **My card**, type your name, LinkedIn, and where you are → scan the
   QR with any phone → your card lands in their contacts with a "Met at …"
   note. Nothing you type there ever leaves the page.

### Environment variables

Set in `.env.local` (copied from `.env.local.example`); only `NEXT_PUBLIC_*` ones
reach the browser.

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_BASE_URL` | `http://127.0.0.1:8000` | Contacts API base URL, read server-side only |
| `API_TIMEOUT_MS` | `8000` | How long to wait before showing "unreachable" |
| `NEXT_PUBLIC_API_BASE_URL` | – | Optional, for the rare client-component fetch; leave unset in production |
| `NEXT_PUBLIC_APP_VERSION` / `NEXT_PUBLIC_BUILD_NUMBER` / `NEXT_PUBLIC_GIT_SHA` | derived | Version-stamp overrides, normally set by CI only |
| `E2E_BASE_URL` | – | Point Playwright at an already-running server instead of starting one |

## What you should see

Use these two screenshots as the smoke test. If `http://localhost:3000` looks
like this and the badge reads `api ok`, the frontend, the API, and the database
are all wired up correctly and you can start building.

> The screenshots predate the photo, address, and QR features — expect the live
> app to show avatars with photos, typed address badges, and a Save to phone
> card that the images below don't have yet.

### `/contacts` — the list

![The contacts list page](docs/UI.png)

The landing route (`/` redirects here). What to check, top to bottom:

- **Header** — `SFContacts` wordmark, `Contacts` / `New contact` nav with the
  current route highlighted, and the theme toggle on the right (dark is the
  default; the sun icon switches to light).
- **`3 contacts` + the badge** — the count comes from the API's `total`, and the
  green-dotted `api ok · sqlite` pill is live `GET /health` output naming the
  backend's database. A red `api unreachable` here means the backend is down or
  `API_BASE_URL` is wrong — everything below it will be empty.
- **Toolbar** — search across name, email, company, and phone, plus a per-page
  selector. Both write to the URL, so the state survives a reload and is
  shareable.
- **Table** — sortable `Name` and `Email` headers (the arrow shows the active
  column and direction), an initials avatar per row, `Job title at Company` as
  the subtitle, and per-row pencil (edit) and trash (delete) actions.
- **Footer row** — `Showing 1–3 of 3` with Previous/Next, both disabled on a
  single page.
- **Version stamp** — `web v0.1.0 (build 2 · 8ce2dc0)` at the bottom of every
  page, so you always know which build you are looking at.

The seed data above (Grace Hopper, Ada Lovelace, Alan Turing) is whatever your
backend was seeded with — your names and IDs will differ, and an empty table
just means an empty database, not a broken app.

### `/contacts/[id]` — a single contact

![A single contact's detail page]
<img width="1876" height="1054" alt="image" src="https://github.com/user-attachments/assets/de723935-c39c-4095-872f-b0832b7cc5ef" />

Click a row to get here. It confirms the detail read path works end to end:

- **`< All contacts`** back link to the list.
- **Header** — avatar, name, and `Job title at Company`, with **Edit**
  (`/contacts/[id]/edit`) and a destructive **Delete** that asks before it acts.
- **Field table** — email and phone rendered as `mailto:` / `tel:` links, then
  company, job title, the typed address list (Home / Work / Other badges), and
  notes. Empty optional fields show `—` rather than collapsing, so the shape of
  the record stays readable.
- **Save to phone** — a QR code a phone camera recognises as a contact card,
  plus a `.vcf` download with every field and the photo embedded.
- **Metadata table** — `ID`, `Created`, and `Last updated` in UTC, monospaced.

Hand-editing the URL to an ID that does not exist gives you the styled 404 page
(`src/app/not-found.tsx`), not a stack trace — that is also worth a quick try.

## Scripts

| Script                    | What it does                                        |
| ------------------------- | --------------------------------------------------- |
| `npm run dev`             | Dev server with fast refresh                         |
| `npm run build`           | Production build                                     |
| `npm start`               | Serve the production build                           |
| `npm run lint`            | ESLint (flat config, `eslint-config-next`)           |
| `npm run typecheck`       | `tsc --noEmit`                                       |
| `npm test`                | Jest unit/component tests                            |
| `npm run test:watch`      | Jest in watch mode                                   |
| `npm run test:coverage`   | Jest with coverage (thresholds in `jest.config.ts`)  |
| `npm run test:e2e`        | Playwright — starts the dev server itself            |
| `npm run test:e2e:ui`     | Playwright UI mode                                   |
| `npm run test:e2e:report` | Open the last HTML report                            |

## Routes

| Route                | What it does                                                     |
| -------------------- | ---------------------------------------------------------------- |
| `/`                  | 308 to `/contacts` (a `redirects()` rule, not a page)             |
| `/contacts`          | List: search, sort, paginate — all held in the URL                |
| `/contacts/new`      | Create form                                                       |
| `/contacts/[id]`     | Detail view with edit/delete                                      |
| `/contacts/[id]/edit`| Edit form (`PUT`, i.e. a full replacement)                        |
| `/my-card`           | Your own QR contact card — client-side only, never touches the API |

## Layout

```
src/app/contacts/(list)/  List page + its loading skeleton
src/app/contacts/         Detail, edit, create routes and the server actions
src/components/contacts/  Feature components (table, toolbar, form, avatar…)
src/components/ui/        Button and Field primitives
src/lib/contacts/         Types, Zod schema, API access, URL query helpers
src/lib/apiClient.ts      fetch wrapper: base URL, ApiError, ApiUnreachableError
src/__tests__/            Jest tests + MSW handlers, mirroring the src/ tree
e2e/                      Playwright specs (run against the real API)
```

`@/*` maps to `src/*` in both TypeScript and Jest.

## How it talks to the API

- **Server-side only.** Reads happen in server components, writes in server
  actions (`src/app/contacts/actions.ts`). `API_BASE_URL` never reaches the
  browser, there is no CORS surface, and no loading waterfall on first paint.
  That means the app needs a Node runtime — `output: "export"` is not supported.
- **`src/lib/contacts/api.ts`** is the only module that knows the endpoint
  shapes. It mirrors `/openapi.json`: `GET /api/v1/contacts` (search, limit,
  offset, sort_by, order), `POST`, `GET|PUT|PATCH|DELETE /api/v1/contacts/{id}`,
  and `GET /health`.
- **Errors are typed, not swallowed.** `404` becomes `null` (→ the 404 page),
  `409` becomes a field error on email, `422` is unpacked from FastAPI's
  `HTTPValidationError` into per-field messages, and an unreachable backend
  becomes `ApiUnreachableError` with a panel that names the URL it tried.
- **List state lives in the URL** (`?q=&sort=&order=&page=&perPage=`), parsed and
  sanitised by `src/lib/contacts/query.ts`. Sorting is validated against the
  API's allow-list, so a hand-edited URL can never produce a 422.

## Conventions

- **Forms** — one source of truth: `CONTACT_FIELD_GROUPS` in
  `src/lib/contacts/schema.ts` drives both the rendered fields and the Zod rules,
  which mirror the API's own limits. Submitting is a real form `action`, so it
  works before hydration; `useActionState` surfaces what comes back.
- **Styling** — Tailwind against semantic CSS variables (`bg-background`,
  `text-muted-foreground`, `border-hairline`, …) defined in `src/app/globals.css`.
  Dark is the default; light lives under `[data-theme="light"]`. Add colours as
  tokens there plus an entry in `tailwind.config.ts` rather than hard-coding hex
  values in components, so both themes stay in sync.
- **Fonts** — Inter / Space Grotesk / JetBrains Mono are self-hosted under
  `src/app/fonts/` via `next/font/local`, so builds never fetch Google Fonts.
- **Version stamp** — `next.config.ts` injects `NEXT_PUBLIC_APP_VERSION`,
  `NEXT_PUBLIC_BUILD_NUMBER` (CI `BUILD_NUMBER`, else git commit count), and
  `NEXT_PUBLIC_GIT_SHA`. `VersionFooter` renders them, so any deployed page shows
  exactly which build it is.
- **Suspense boundaries change HTTP status.** The list skeleton sits in the
  `(list)` route group on purpose: a `loading.tsx` directly under `contacts/`
  would also wrap `[id]`, flush the shell early, and turn its `notFound()` 404
  into a 200.
- **Tests** — HTTP is stubbed with MSW (`src/__tests__/mocks/`), never by mocking
  `fetch` directly. Query by role/label over test IDs. Three bits of
  `jest.config.ts`/`jest.setup.ts` exist purely to make this stack work under
  Jest and should not be removed casually: the `jest-fixed-jsdom` environment
  (keeps Node's `fetch`/`Request`/stream globals, which plain jsdom strips), the
  `transformIgnorePatterns` override (MSW's dependency tree is ESM-only), the
  `server-only` module mapping, and the `FormData` shim (undici's `FormData`
  cannot be built from a `<form>`, which is what React 19 does on submit).

## End-to-end tests

`e2e/` runs against a **real** backend: each test creates its own contact with a
unique email and deletes it again. Playwright's default is three browsers in
parallel with up to 8 workers; if your backend is a single-worker uvicorn on
in-memory SQLite, that concurrency can wedge it — run `npm run test:e2e --
--workers=2` (or `--project=chromium`) against a dev backend you don't mind
restarting.

## How it was built — the PR trail

Every feature landed as its own reviewed pull request, and each one went
through a full [Qodo](https://qodo.ai) review cycle: findings raised, fixed,
and re-reviewed to zero open bugs before merging.

| PR | What it shipped |
| --- | --- |
| [#1](https://github.com/Rikinshah787/sf-frontend/pull/1) | Contact photo upload with circular avatars |
| [#2](https://github.com/Rikinshah787/sf-frontend/pull/2) | Many typed addresses per contact |
| [#3](https://github.com/Rikinshah787/sf-frontend/pull/3) | Save to phone: QR code + vCard export |
| [#4](https://github.com/Rikinshah787/sf-frontend/pull/4) | My card: pocket QR with LinkedIn and a "met at" note |
| [#5](https://github.com/Rikinshah787/sf-frontend/pull/5) | Photo picker UX: drop zone, progress state, file summary |
| [#6](https://github.com/Rikinshah787/sf-frontend/pull/6) | UX pass: form cards, sticky save, hero header |

The API side (photo column, one-to-many Address table) lives in
[sf-backend's PRs](https://github.com/Rikinshah787/sf-backend/pulls?q=is%3Apr+is%3Amerged).
Review highlights worth reading: Qodo caught a Unicode line-folding bug in the
vCard export (#3), a stale-QR race in My card (#4), and a drag-and-drop path
that bypassed the photo format allowlist (#5) — each fixed and re-reviewed in
the same PR.

## Deployment

Standard Node server build: `npm run build && npm start`. Set `API_BASE_URL` in
the server environment to wherever the Contacts API lives.
