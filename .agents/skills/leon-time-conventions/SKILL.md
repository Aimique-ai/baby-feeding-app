---
name: leon-time-conventions
description: Use when changing dates, times, calendar days, timezone handling, feedings, weights, history, day-of-life, or date/time API boundaries in the Leon app.
---

# Leon Time Conventions

Use the project's explicit timezone model. Never rely on the process timezone or the browser's implicit locale for calendar-day semantics.

## Core Model

- Absolute instants (`startAt`, `endAt`, `birthDate`, `createdAt`, `archivedAt`) are UTC `Date` values in storage and ISO strings over the wire.
- Calendar days are `dateISO + IANA tz`, for example `2026-05-15` with `Europe/Bucharest`.
- Server code must translate calendar-day boundaries to UTC with `startOfLocalDay`, `endOfLocalDay`, or `dayRangeUtc`.
- Use `localDateISO(date, tz)` for "today" or for deriving a local calendar day from an instant.

## Do Not

- Do not use `format(new Date(), "yyyy-MM-dd")` for application calendar days.
- Do not use `toLocaleDateString()` without an explicit timezone.
- Do not hand-roll day ranges or UTC offset math.
- Do not treat `new Date("YYYY-MM-DD")` as a local day.

## API Rule

- Client-originated requests whose result or mutation depends on timezone must send `x-time-zone`.
- Route handlers must prefer a valid `x-time-zone` header, then a valid `tz` cookie, then `DEFAULT_TZ`.
- The `tz` cookie is for SSR synchronization and fallback. It is not the only source of truth for client mutations.
