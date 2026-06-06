import { Hono } from "hono";

export const healthLiveRoute = new Hono();

healthLiveRoute.get("/", (c) => c.json({ ok: true }));
