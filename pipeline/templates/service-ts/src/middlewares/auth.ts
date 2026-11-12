// Requires a signed-in user (optionally with one of the given roles) and puts it on c.var.user.
import { createMiddleware } from "hono/factory";
import { Forbidden, Unauthorized } from "../lib/errors.js";
import { readToken, type TokenUser } from "../lib/security.js";

export type AuthEnv = { Variables: { user: TokenUser } };

export const requireUser = (...roles: string[]) =>
  createMiddleware<AuthEnv>(async (c, next) => {
    const header = c.req.header("Authorization");
    const user = header?.startsWith("Bearer ") ? await readToken(header.slice(7)) : null;
    if (!user) throw new Unauthorized("Please sign in");
    if (roles.length && !roles.includes(user.role)) throw new Forbidden("You don't have access to this");
    c.set("user", user);
    await next();
  });
