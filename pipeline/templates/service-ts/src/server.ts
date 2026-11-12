// Local server for the preview and the self-test. Online, Vercel runs api/index.ts instead.
import { serve } from "@hono/node-server";
import app from "./app.js";
import { env } from "./config/env.js";

serve({ fetch: app.fetch, port: env.port }, () => console.log(`API service on http://localhost:${env.port}`));
