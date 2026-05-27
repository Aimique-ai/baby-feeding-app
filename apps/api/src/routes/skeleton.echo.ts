import { Hono } from "hono";

export const skeletonEchoRoute = new Hono();

skeletonEchoRoute.get("/", (c) => c.json([]));

skeletonEchoRoute.post("/", async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as { volumeMl?: number };
  return c.json({
    id: `echo-${Date.now()}`,
    startAt: new Date().toISOString(),
    volumeMl: body.volumeMl ?? 0,
  });
});
