import { Hono } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { corsMw } from "./middleware/cors.js";
import { tz } from "./middleware/tz.js";
import { activeBaby } from "./middleware/activeBaby.js";
import { onError } from "./middleware/errors.js";
import { healthLiveRoute } from "./routes/health.live.js";
import { healthRoute } from "./routes/health.js";
import { healthDbRoute } from "./routes/health.db.js";
import { babiesRoute } from "./routes/babies.js";
import { formulasRoute } from "./routes/formulas.js";
import { skeletonEchoRoute } from "./routes/skeleton.echo.js";
import { babyRoute } from "./routes/baby.js";
import { feedingsRoute } from "./routes/feedings.js";
import { feedingsAnalyticsRoute } from "./routes/feedings.analytics.js";
import { feedingsDurationChipsRoute } from "./routes/feedings.duration-chips.js";
import { feedingsLastBeforeRoute } from "./routes/feedings.last-before.js";
import { feedingsPlanRoute } from "./routes/feedings.plan.js";
import { historyRoute } from "./routes/history.js";
import { medicationsRoute } from "./routes/medications.js";
import { weightsRoute } from "./routes/weights.js";
import { weightsAnalyticsRoute } from "./routes/weights.analytics.js";
import { pushRoute } from "./routes/push.js";
import {
  feedingsTimerRoute,
  timersPublicRoute,
} from "./routes/feedings.timer.js";
import type { AppEnv } from "./types.js";

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", corsMw);
  app.use("*", tz);

  app.route("/api/health/live", healthLiveRoute);
  app.route("/api/health", healthRoute);
  app.route("/api/health/db", healthDbRoute);
  app.route("/api/babies", babiesRoute);
  app.route("/api/formulas", formulasRoute);
  app.route("/api/skeleton/echo", skeletonEchoRoute);
  app.route("/api/push", pushRoute);
  // Outside babyScoped: EventSource can't send the x-active-baby-id header.
  app.route("/api/timers", timersPublicRoute);

  const babyScoped = new Hono<AppEnv>();
  babyScoped.use("*", activeBaby);
  // Order matters: nested paths first so the `/feedings` prefix doesn't swallow them.
  babyScoped.route(
    "/feedings/analytics/duration-chips",
    feedingsDurationChipsRoute,
  );
  babyScoped.route("/feedings/analytics", feedingsAnalyticsRoute);
  babyScoped.route("/feedings/last-before", feedingsLastBeforeRoute);
  babyScoped.route("/feedings/plan", feedingsPlanRoute);
  babyScoped.route("/feedings/timer", feedingsTimerRoute);
  babyScoped.route("/feedings", feedingsRoute);
  babyScoped.route("/baby", babyRoute);
  babyScoped.route("/history", historyRoute);
  babyScoped.route("/medications", medicationsRoute);
  babyScoped.route("/weights/analytics", weightsAnalyticsRoute);
  babyScoped.route("/weights", weightsRoute);
  app.route("/api", babyScoped);

  app.all("/api/*", (c) => c.json({ error: "Not Found" }, 404));

  if (process.env.NODE_ENV === "production") {
    const WEB_ROOT = process.env.WEB_ROOT ?? "./client";
    app.use("*", serveStatic({ root: WEB_ROOT }));
    app.get("*", serveStatic({ path: "index.html", root: WEB_ROOT }));
  }

  app.onError(onError);
  return app;
}
