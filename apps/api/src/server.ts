import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { pingReminderRedis } from "./scheduler/queue.js";
import { startReminderWorker } from "./scheduler/startWorker.js";

const port = Number(process.env.PORT ?? 8787);

void pingReminderRedis();
startReminderWorker();

serve({ fetch: createApp().fetch, port }, (info) => {
  console.info(`[api] ready on ${info.port}`);
});
