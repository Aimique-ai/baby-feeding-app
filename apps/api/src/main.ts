import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { dbConnect } from "./db/mongo.js";

const port = Number(process.env.PORT ?? 8080);
const hostname = process.env.HOST ?? "0.0.0.0";

dbConnect().catch((err) => {
  console.error("[api] initial db connect failed:", err);
});

serve({ fetch: createApp().fetch, port, hostname }, (info) => {
  console.info(`[api] ready on ${info.address}:${info.port}`);
});
