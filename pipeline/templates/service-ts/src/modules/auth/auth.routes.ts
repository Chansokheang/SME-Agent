// POST /api/v1/auth/login {email, password} -> {data: {token, user}}
// GET  /api/v1/auth/me -> {data: user}
//
// Routes are HTTP only: describe the address (createRoute, with its Swagger tag), read the
// validated input, call the service, answer { data }. No Prisma and no business rules here.
import { createRoute } from "@hono/zod-openapi";
import { createRouter, json } from "../../lib/router.js";
import { requireUser, type AuthEnv } from "../../middlewares/auth.js";
import { ErrorAnswer, LoginAnswer, LoginIn, MeAnswer } from "./auth.schemas.js";
import { authService } from "./auth.service.js";

const TAGS = ["Auth"];
export const authRoutes = createRouter<AuthEnv>();

authRoutes.openapi(
  createRoute({
    method: "post",
    path: "/login",
    tags: TAGS,
    summary: "Sign in",
    request: { body: { content: { "application/json": { schema: LoginIn } } } },
    responses: { 200: json(LoginAnswer, "Signed in"), 401: json(ErrorAnswer, "Wrong email or password") },
  }),
  async (c) => {
    const { email, password } = c.req.valid("json");
    return c.json({ data: await authService.login(email, password) }, 200);
  },
);

authRoutes.use("/me", requireUser());
authRoutes.openapi(
  createRoute({
    method: "get",
    path: "/me",
    tags: TAGS,
    summary: "The signed-in user",
    security: [{ bearer: [] }],
    responses: { 200: json(MeAnswer, "The user"), 401: json(ErrorAnswer, "Not signed in") },
  }),
  async (c) => c.json({ data: await authService.me(c.var.user.userId) }, 200),
);
