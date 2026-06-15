# Migration assessment: MongoDB/Mongoose → PostgreSQL + Drizzle

_Assessment date: 2026-06-11. Scope: feasibility, effort, and risk of moving the primary datastore from MongoDB (via Mongoose) to PostgreSQL with Drizzle ORM. No code changed — this is analysis only._

## TL;DR

**Verdict: low-risk, well-scoped, recommended if there's a real reason to move.** The data model is small and purely relational, the query layer is trivial (no aggregations, no `populate`, no transactions, no Mongo-specific features beyond a handful of upserts and two case-insensitive lookups), and the dataset is tiny (≈240 documents total). Postgres is arguably a *better* fit than Mongo for this data — every collection is a flat table with foreign keys.

The one non-trivial part is **not** the database: it's that Mongo's 24-character hex `ObjectId` format is hardcoded into the API contract (Zod schemas), the API responses (`_id` key), and the **frontend** (localStorage, deep-link query param, response-header echo, form validation). That coupling has to be handled deliberately, but it's mechanical, not architectural.

Estimated effort: **~1–2 focused days** for a developer who knows the codebase, including data migration and frontend changes. There is no operational data-migration risk worth speaking of.

**Should you do it?** Only if you have a concrete driver — wanting relational integrity / FKs, SQL for analytics, one fewer managed service (you already run Postgres-friendly infra on Fly), typed schema-first migrations, or simply preferring SQL. There is no correctness problem with the current Mongo setup. This is a quality/preference move, not a rescue.

---

## Current architecture (what exists today)

- **API**: Hono on Node, deployed to Fly (`leon-api`, region `fra`). `apps/api`.
- **Primary datastore**: MongoDB via **Mongoose 9** (`MONGODB_URI`). Connection is a cached global singleton (`src/db/mongo.ts`).
- **Models** (6): `Baby`, `Feeding`, `Formula`, `Medication`, `Weight`, `PushSubscription` (`src/models/*.ts`).
- **Redis** (ioredis + BullMQ): push-reminder scheduling (delayed jobs) and cross-device feeding-timer state. **This is a separate concern and stays exactly as-is** — see "What does NOT move".
- **Frontend**: React Router v7 SPA (`apps/web`), TanStack Query + axios, talks to the API over HTTP.
- **Shared contract**: `packages/schemas` (Zod) — used by both API and web. `packages/domain` is pure planning/WHO math, **DB-agnostic, untouched**.
- **Data volume** (per `docs/db-dump/_summary.json`, 2026-05-26): babies 4, feedings 215, weights 11, medications 6, formulas 2. This is a single-family personal app.

### The data model is already relational

Every model is a flat document with scalar fields and `ObjectId` references — no embedded subdocuments, no arrays-of-objects, with one mild exception (`PushSubscription.babyIds` is an array of refs = a many-to-many). Mapping to Postgres:

| Mongo collection | Postgres table | Notes |
|---|---|---|
| `babies` | `babies` | FK `current_formula_id → formulas.id` (nullable). Partial unique index on `name WHERE archived_at IS NULL`, case-insensitive. |
| `feedings` | `feedings` | FK `baby_id → babies.id`, FK `medication_id → medications.id` (nullable). Index `(baby_id, start_at)`. |
| `formulas` | `formulas` | Check constraints already encoded in schema (kcal 40–100, protein 0.5–5). |
| `medications` | `medications` | FK `baby_id`. Partial unique on `(baby_id, name) WHERE deleted_at IS NULL`, case-insensitive. |
| `weights` | `weights` | FK `baby_id`. Unique `(baby_id, date)`. |
| `push_subscriptions` | `push_subscriptions` + `push_subscription_babies` | The `babyIds` array becomes a join table (the only real shape change). Alternatively keep it denormalized as a Postgres array/JSONB column — see "M2M decision". |

`createdAt`/`updatedAt` (Mongoose `timestamps: true`) become `created_at`/`updated_at` with `defaultNow()` + an update trigger or app-level `.$onUpdate()`. Only `Weight` uses `createdAt`-only; `Medication.createdAt` is the **single timestamp surfaced in an API response** — keep it.

---

## Query layer: the easy part

A full inventory of all 53 Mongoose call sites across routes/lib/scheduler/scripts:

| Category | Count | Drizzle difficulty |
|---|---|---|
| Simple CRUD (`find`, `findById`, `findOne`, `create`, `findByIdAndUpdate`, `findOneAndUpdate`, `deleteOne`, `findByIdAndDelete`, `exists`, `updateMany`) | 45 | Trivial — 1:1 equivalents |
| **Aggregation pipelines** (`.aggregate`) | **0** | — |
| **`.populate()`** (cross-collection joins) | **0** | — |
| **Transactions / sessions** | **0** | — |
| Special: upserts (3), case-insensitive `.collation()` lookups (2), `$setOnInsert`/`$ne`/`$or`/`$exists` (3) | 8 | Easy–medium |

Why this matters: the hard parts of a Mongo→SQL migration are normally (a) unwinding aggregation pipelines into SQL `GROUP BY`/window functions and (b) replacing `populate` with joins. **There are none here.** All cross-entity work (e.g. building the feeding plan, analytics, history) already happens by issuing separate simple `find` queries and combining in application code (`@leon/domain`), which is exactly how it would work with Drizzle.

### The 8 special cases, and how each maps

1. **Upserts** (`weights.ts` weight-by-date, `push.ts` subscription-by-endpoint, `seed-formulas.ts`): → Drizzle `.insert(...).onConflictDoUpdate({ target, set })` / `.onConflictDoNothing()`. The unique indexes that back them already exist conceptually.
2. **Case-insensitive uniqueness** (`medications.ts`, two `.collation({ locale: "en", strength: 2 })` lookups + the partial unique indexes on `babies.name` and `medications.(babyId,name)`): this is the **one design decision** requiring thought. Options, in order of preference:
   - Use the Postgres **`citext`** extension for the `name` columns → the unique index and the lookups become naturally case-insensitive, closest to current behavior.
   - Or add a generated `lower(name)` column / functional unique index `(baby_id, lower(name))` and `lower()` the lookups in app code.
   - `citext` is the smallest code delta.
3. **`$ne` / `$or` / `$exists` / `$setOnInsert`** (collision check excluding self; the one-shot `backfill-baby-formula.ts`): → `ne()`, `or()`, `isNull()`, and `onConflictDoNothing`/explicit insert columns respectively. All mechanical. Note the backfill script is one-shot tooling, not hot-path.
4. **`.lean()`** (on essentially every read): no equivalent needed — Drizzle returns plain objects natively. The serializers were even written against a structural `…DocLike` type with `_id: { toString() }`, so they're already loosely coupled to Mongoose.

---

## The actual work: the `ObjectId` contract coupling

This is the only part that touches more than the API's data layer. Mongo's `_id` is a 24-char hex string, and that exact format is asserted in many places. Switching the DB means switching the ID format (to `uuid` or `text`), which ripples outward.

### Where the 24-hex format is hardcoded

**Contract (`packages/schemas`)** — shared by API + web:
- `objectId.ts`: `OBJECT_ID_REGEX = /^[a-fA-F0-9]{24}$/`, `objectIdString`. Used by every entity schema for `_id`, `babyId`, `currentFormulaId`, `medicationId`.
- `baby.ts` also has an inline copy of the regex for `currentFormulaId` input.

**API**:
- All 6 serializers emit `_id: doc._id.toString()` and stringify ref fields (`babyId`, `currentFormulaId`, `medicationId`). **The JSON key is `_id`, not `id`** — the client depends on this.
- `middleware/activeBaby.ts`: validates the `x-active-baby-id` header against `HEX_24`, echoes `X-Active-Baby-Id` back.
- Every mutating route has `isValidId = (id) => Types.ObjectId.isValid(id)` and constructs `new Types.ObjectId(baby._id)` for queries, comparing with `.equals(...)`.
- `lib/assertFormulaExists.ts`, `lib/resolveFormulaDensity.ts`, `lib/serializeBabyWithFormula.ts`: guard with `Types.ObjectId.isValid(...)`.

**Frontend (`apps/web`)** — 37 reads of `._id`, plus format assertions:
- `lib/baby/active.ts`: reads/writes `localStorage["activeBabyId"]`, **validates 24-hex on read**.
- `lib/http/client.ts`: persists echoed `x-active-baby-id` only if it matches 24-hex.
- `entry.client.tsx`: notification deep-link `/?baby=<id>` accepted only if 24-hex (`HEX_24`).
- `lib/forms/feedingForm.ts`: inline 24-hex regex for `medicationId`.

### Two ways to handle it

**Option A — keep the wire contract identical (recommended for least blast radius).**
Make the DB IDs `text` and **generate 24-char hex values** (or `uuid` rendered however you like, but hex keeps the regex valid). Keep emitting the `_id` key. Then:
- `packages/schemas` regex stays valid → **zero frontend changes**, zero schema changes.
- Drop the `Types.ObjectId` construction in routes (compare strings directly), replace `Types.ObjectId.isValid` with a regex test or a trivial helper.
- Serializers' `.toString()` becomes a no-op on a string (harmless) or is removed.
- Existing IDs from the Mongo dump transfer **verbatim** (they're already 24-hex), so deep links, any saved `activeBabyId` in users' browsers, and existing push subscriptions keep working.

This is the pragmatic path: the frontend and the public contract don't change at all; only the API's internal data layer does.

**Option B — switch to real `uuid` and rename `_id → id` on the wire.**
Cleaner long-term (`uuid` columns, idiomatic Postgres), but it's a breaking contract change: update every schema, all 37 frontend `._id` reads, the localStorage/deep-link/header validators, and you must remap old IDs on import. More churn, a coordinated FE/BE deploy, and it invalidates any `activeBabyId` already in a browser. Only worth it if you specifically want `uuid` as a principle. Could also be deferred to a follow-up after A lands.

> Recommendation: **Option A.** It decouples "change the database" from "change the API contract," so the migration is a backend-internal change you can ship and verify without touching the SPA.

---

## What does NOT move (stays on Redis / in-memory)

The Redis/BullMQ/timer stack is independent of the primary datastore. Confirmed by reading every scheduler/timer/push file:

- **Reminder scheduling** (`scheduler/*`): BullMQ delayed jobs in Redis. The only Mongo touch is `scheduler/worker.ts:25` `BabyModel.findById(babyId)` (re-validate baby exists/!archived on fire) — that one read becomes a Drizzle query.
- **Feeding-timer state** (`timer/store.ts`): Redis KV (`feeding:timer:{babyId}`). No Mongo. Untouched.
- **SSE timer fan-out** (`timer/hub.ts`): in-process `Set`. Untouched.
- **Web push** (`push/webpush.ts`, `routes/push.ts`): reads/writes `PushSubscription` and `Baby` in Mongo → those become Drizzle queries. The web-push transport itself is unchanged.

So the files that change purely because of the DB swap: **`scheduler/worker.ts` (1 query), `push/webpush.ts` (2 queries), `routes/push.ts` (6 queries)** — plus the route/lib data layer. Everything BullMQ/Redis/SSE stays byte-for-byte.

---

## Suggested migration shape (if you proceed)

A sketch, not a committed plan — keeping the wire contract via Option A:

1. **Add deps & infra**: `drizzle-orm`, `drizzle-kit`, a Postgres driver (`postgres` / `pg`). Provision Postgres (Fly Postgres, or Supabase/Neon). New env `DATABASE_URL`; keep `MONGODB_URI` until cutover.
2. **Schema** (`src/db/schema.ts`): define the 6 tables + the M2M join table, with FKs, the partial/unique indexes, `citext` for `name` columns, and check constraints. Generate the initial migration with drizzle-kit.
3. **DB client** (`src/db/drizzle.ts`): pooled connection, mirroring the cached-singleton pattern in `mongo.ts`.
4. **Port the data layer** route-by-route: swap Mongoose calls for Drizzle. Order suggestion: `formulas` (simplest, system data) → `babies` → `weights` → `medications` (the citext/collation case) → `feedings` (most call sites) → `push` + `scheduler/worker`. Keep serializers; make `_id` a passthrough.
5. **Drop `Types.ObjectId` usage**: replace `isValidId` with a string/regex check; remove `new Types.ObjectId(...)` and `.equals(...)`.
6. **Data migration script**: read the 6 collections (the repo already has a dump in `docs/db-dump/`), insert into Postgres preserving the 24-hex IDs as `text` PKs, expand `babyIds` into the join table. Trivial at this volume; can even run from the JSON dump.
7. **Rewrite the two `scripts/`** (`seed-formulas`, `backfill-baby-formula`) against Drizzle, or retire the backfill (one-shot, likely already applied).
8. **Cutover**: deploy API pointing at Postgres, run the import, verify health (`/api/health/db`), smoke-test. Frontend ships nothing (Option A). Decommission Mongo once satisfied.
9. **Remove** `mongoose` from `apps/api/package.json`, delete `src/db/mongo.ts`, `src/db/registerModel.ts`, `src/models/*`.

### Effort / risk

- **Effort**: ~1–2 days for someone fluent in the codebase. The bulk is mechanical query porting (45 trivial sites) + schema definition; the only "thinking" is the citext decision and the ID strategy (both resolved above).
- **Data risk**: negligible. ~240 rows, no concurrent multi-tenant writes, a personal app. Keep Mongo readable during cutover for instant rollback.
- **Contract risk**: zero with Option A (wire format preserved). Non-zero with Option B (coordinated FE/BE breaking change).
- **What could bite**: (1) case-insensitive uniqueness semantics if `citext` isn't used and `lower()` normalization is missed; (2) timezone/`Date` handling — store `timestamptz`, and the project's `leon-time-conventions` rules still apply; (3) the M2M join for push subscriptions is the one place where "shape" actually changes.

---

## Recommendation

If you have a concrete reason — wanting SQL/relational guarantees, FK integrity, SQL analytics, fewer moving services, or schema-first typed migrations — **this is a clean migration and worth doing**, via **Option A** (preserve the wire contract, IDs stay 24-hex `text`, frontend untouched). The codebase is about as friendly to this change as a Mongo app gets: no aggregations, no joins-via-populate, no transactions, tiny data.

If there's **no** concrete driver, note that the current Mongo setup has no correctness problem; this would be a preference/quality investment, not a fix. Given the active "heavy experimentation with planning algorithms" phase (per `AGENTS.md`), it's reasonable to defer unless the relational model would directly help that work (e.g. you want to run SQL over feeding/weight history).

### Open questions for you
- **Driver for the move?** Relational integrity, SQL analytics, dropping a managed service, or just preference? This decides whether it's worth doing now vs. later.
- **Postgres host?** Fly Postgres (keeps everything on Fly, one region) vs. Neon/Supabase (managed, branching).
- **ID strategy?** Option A (24-hex `text`, no contract change — recommended) vs. Option B (`uuid`, breaking but idiomatic).
- **`citext` acceptable?** It's the cleanest way to preserve the case-insensitive name uniqueness; otherwise we go with functional `lower(...)` indexes.
