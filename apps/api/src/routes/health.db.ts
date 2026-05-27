import { Hono } from "hono";
import mongoose from "mongoose";
import { dbConnect } from "../db/mongo.js";

export const healthDbRoute = new Hono();

healthDbRoute.get("/", async (c) => {
  await dbConnect();
  const admin = mongoose.connection.db?.admin();
  const ping = admin ? await admin.ping() : { ok: 0 };
  return c.json({ ok: true, ping });
});
