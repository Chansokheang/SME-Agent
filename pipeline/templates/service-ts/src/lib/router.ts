// Every module's routes start from createRouter(): an OpenAPIHono whose bad input answers like
// every other error (400 with the fields to fix), and helpers for describing answers.
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Env } from "hono";

export function createRouter<E extends Env = Env>() {
  return new OpenAPIHono<E>({
    defaultHook: (result, c) => {
      if (!result.success) {
        const fields = Object.fromEntries(result.error.issues.map((i) => [i.path.join(".") || "body", i.message]));
        return c.json({ error: { code: "invalid_input", message: "Some fields need fixing", fields } }, 400);
      }
    },
  });
}

/** An OpenAPI answer: json(Schema, "What it is"). */
export const json = <T>(schema: T, description: string) => ({
  content: { "application/json": { schema } },
  description,
});
