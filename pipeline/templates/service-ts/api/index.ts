// Vercel entry point: every address is routed here (vercel.json) and answered by the same app.
import { handle } from "@hono/node-server/vercel";
import app from "../src/app.js";

export default handle(app);
