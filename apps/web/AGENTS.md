# apps/web

React Router v7 frontend. Import alias is `~/` only (→ `./app/*`).

## `app/` layout

```
components/   # ui primitives and chrome components (non-feature)
features/     # domain features (flat list of capsules)
hooks/        # shared hooks
lib/          # utils, queryKeys
providers/    # global providers
routes/       # file-based routes
```

## features vs components

- **feature** — tied to the domain, queries, or app context; not portable to another project (e.g. `DayView`, `FeedingSheet`, `WeightAnalytics`). Lives in `features/`.
- **component** — portable, domain-agnostic: ui primitives plus chrome like the header, sidebar, theme toggle. Lives in `components/`.
- `components/ui/` holds vendored shadcn primitives — don't restructure them.

## Capsules

Each component is a `CamelCase/` folder with its own `index.ts`. The index re-exports only what's used from outside.

```
FeedingSheet/
  FeedingSheet.tsx
  index.ts
  constants.ts / utils.ts / context.ts / hooks/   # as needed
  FeedingSheetContent/                             # child component, same structure
```

- `features/` is flat — no grouping folders, no group barrels.
- Child components nest as folders inside their parent. A component reused between them goes to `shared/` at the parent level.
- Constants, utils, contexts and hooks are encapsulated inside the capsule. A context lives inside its provider.
- Import between capsules through the `~/features/X` barrel, never reach inside.
- Naming: `CamelCase` for capsules/components, `camelCase` for hooks/utils.
