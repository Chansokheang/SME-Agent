// What the auth addresses take and answer (zod, also used for the OpenAPI docs).
import { z } from "@hono/zod-openapi";

export const LoginIn = z.object({
  email: z.string().email("Enter a valid email").openapi({ example: "admin@example.test" }),
  password: z.string().min(1, "Enter your password"),
});

export const UserOut = z
  .object({ id: z.string(), email: z.string(), name: z.string().nullable(), role: z.string() })
  .openapi("User");

export const LoginAnswer = z.object({ data: z.object({ token: z.string(), user: UserOut }) });
export const MeAnswer = z.object({ data: UserOut });
export const ErrorAnswer = z
  .object({ error: z.object({ code: z.string(), message: z.string(), fields: z.record(z.string()).optional() }) })
  .openapi("Error");

export type UserOut = z.infer<typeof UserOut>;
