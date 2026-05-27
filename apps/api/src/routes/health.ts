import { Hono } from "hono";
import { dbConnect } from "../db/mongo.js";

export const healthRoute = new Hono();

healthRoute.get("/", async (c) => {
  const conn = await dbConnect();
  return c.json({ ok: true, readyState: conn.connection.readyState });
});
