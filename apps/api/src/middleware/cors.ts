import { cors as honoCors } from "hono/cors";
import { ACTIVE_BABY_HEADER, TZ_HEADER } from "@leon/schemas/headers";

const origin = process.env.WEB_ORIGIN ?? "*";

export const corsMw = honoCors({
  origin,
  allowHeaders: ["Content-Type", TZ_HEADER, ACTIVE_BABY_HEADER],
  exposeHeaders: ["X-Active-Baby-Id"],
  credentials: false,
});
