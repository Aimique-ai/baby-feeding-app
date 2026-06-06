# Project structure

The project is a pnpm monorepo (`apps/` + `packages/`): a React Router v7 frontend in `apps/web`, a Hono API in `apps/api`, and shared packages in `packages/` (`schemas`, `contracts`, `domain`).

# Git

Never commit on your own. Do not run `git commit`, `git push`, `git reset`, `git rebase`, or similar operations that change history or the index without an explicit request from the user. Make edits to files and leave them uncommitted — the user decides what and when to commit.

# Tests

We're in the middle of heavy experimentation with planning algorithms — no tests for now. Do not create `*.test.ts` files and do not suggest adding coverage until the user explicitly asks.

# Time and dates

When working with dates, time, calendar days, timezones, feedings, weight, history, or day-of-life, use the project skill `leon-time-conventions`.

# Code comments

Code comments must be in English only. This applies to inline comments, JSDoc, and file headers. (Documentation in `.md` files and chat messages may be in any language.)
