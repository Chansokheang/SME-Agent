// Every setting the service reads from its environment, in one place.

/** All addresses live under this prefix (e.g. /api/v1/rooms). /health and /docs stay outside it. */
export const API_PREFIX = "/api/v1";

export const env = {
  appName: process.env.APP_NAME ?? "API",
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.SERVICE_JWT_SECRET ?? "",
  tokenDays: Number(process.env.TOKEN_DAYS ?? 7),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean),
};
