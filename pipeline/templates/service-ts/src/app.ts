// The website's API service: every page of the website (and any app or partner) reads and
// changes data only through these addresses. The website itself never touches the database.
//
// Layout (see service/README.md): config/ (settings), db/ (Prisma client), lib/ (errors,
// security), middlewares/ (auth), modules/<resource>/ (routes -> service -> repository).
import { swaggerUI } from "@hono/swagger-ui";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { ZodError } from "zod";
import { API_PREFIX, env } from "./config/env.js";
import { AppError } from "./lib/errors.js";
import { createRouter } from "./lib/router.js";
import { authRoutes } from "./modules/auth/auth.routes.js";

export const app = createRouter();

app.use("*", cors({ origin: (origin) => (env.allowedOrigins.includes(origin) ? origin : null), credentials: true }));

// The platform and Deployment check this to know the service is up (outside the version prefix).
app.get("/health", (c) => c.json({ ok: true }));

// One line per resource, each module mounted under the version prefix.
app.route(`${API_PREFIX}/auth`, authRoutes);
// e.g. app.route(`${API_PREFIX}/rooms`, roomsRoutes);

app.openAPIRegistry.registerComponent("securitySchemes", "bearer", { type: "http", scheme: "bearer" });
app.doc("/openapi.json", { openapi: "3.0.0", info: { title: env.appName, version: "1.0.0" } });
app.get("/docs", swaggerUI({ url: "/openapi.json" }));

// Every error answers in the same JSON shape: { error: { code, message, fields? } }.
app.onError((err, c) => {
  if (err instanceof AppError) {
    const error = { code: err.code, message: err.message, ...(err.fields ? { fields: err.fields } : {}) };
    return c.json({ error }, err.status as 400);
  }
  if (err instanceof ZodError) {
    const fields = Object.fromEntries(err.issues.map((i) => [i.path.join(".") || "body", i.message]));
    return c.json({ error: { code: "invalid_input", message: "Some fields need fixing", fields } }, 400);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: "error", message: err.message } }, err.status);
  }
  console.error(err);
  return c.json({ error: { code: "server_error", message: "Something went wrong." } }, 500);
});
app.notFound((c) => c.json({ error: { code: "not_found", message: "Not found." } }, 404));

export default app;
