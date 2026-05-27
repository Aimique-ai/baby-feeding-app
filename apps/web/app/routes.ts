import { type RouteConfig, layout, route, index } from "@react-router/dev/routes";

export default [
  layout("routes/_layout.tsx", [
    index("routes/_index.tsx"),
    route("weight", "routes/weight._index.tsx"),
    route("weight/analytics", "routes/weight.analytics.tsx"),
    route("history", "routes/history._index.tsx"),
    route("history/analytics", "routes/history.analytics.tsx"),
    route("history/:date", "routes/history.$date.tsx"),
    route("medications", "routes/medications.tsx"),
    route("babies", "routes/babies._index.tsx"),
    route("babies/archive", "routes/babies.archive.tsx"),
    route("settings", "routes/settings.tsx"),
    route("sandbox", "routes/sandbox.tsx"),
    route("skeleton", "routes/skeleton.tsx"),
  ]),
] satisfies RouteConfig;
