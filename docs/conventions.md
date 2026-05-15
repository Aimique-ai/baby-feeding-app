# Conventions

## Runtime

Every Server Component, Route Handler, and server-only module that touches
Mongoose MUST start with:

```ts
export const runtime = "nodejs";
```

The Edge runtime cannot run Mongoose. Forgetting this causes opaque build /
runtime failures. Place the directive at the top of the file, before imports
of `lib/mongodb.ts`, models, or anything that transitively pulls them.

## React Query cache shape

The cache holds **raw entities**, never derived plan output.

- Feedings list: `['feedings', dateISO, tz]` → `Feeding[]`
- Weights list: `['weights']` → `Weight[]`
- Baby: `['baby']` → `Baby`

Plan structures (start plan, working plan, tail) are **derived**
in `useMemo` from the raw entities at render time. They are never written to
the cache. Reasons:

1. Stale derivations are worse than recomputing — pipeline output depends on
   `now`, which advances independently of cache freshness.
2. Mutations need to invalidate one shape, not many.
3. Hydration boundaries serialize raw entities cleanly; derivations contain
   `Date` instances that need consistent timezone handling.

## Time

The server gets the user's IANA timezone from the `tz` cookie for SSR. On first
paint (no cookie yet) the server falls back to `Europe/Kyiv`; a small client
effect writes the cookie via `Intl.DateTimeFormat().resolvedOptions().timeZone`
and calls `router.refresh()` so subsequent server renders use the browser zone.

Client-originated API requests whose meaning depends on timezone send
`x-time-zone`. Route handlers prefer a valid `x-time-zone` header, then a valid
`tz` cookie, then `Europe/Kyiv`.

Calendar days are always modeled as `dateISO + IANA tz`. Use
`localDateISO(date, tz)` for "today" and for deriving a local day from an
instant. Do not use `format(new Date(), "yyyy-MM-dd")` or
`toLocaleDateString()` for application calendar days without an explicit
timezone.

`lib/time/dayRange.ts` is the only module that converts (`dateISO`, `tz`) to
UTC range bounds. Do not roll your own.

## Numbers

Math runs in floats. Display rounding to integer ml happens at the formatter
boundary in `lib/format/`. Half-up.
