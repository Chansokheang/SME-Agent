// Errors the services throw (never Hono's HTTPException): they know the rule, not HTTP.
// app.ts turns every error into the same JSON answer: { error: { code, message, fields? } }.

export class AppError extends Error {
  status = 400;
  code: string;
  fields?: Record<string, string>;
  constructor(message: string, code = "bad_request", fields?: Record<string, string>) {
    super(message);
    this.code = code;
    this.fields = fields;
  }
}

const kind = (status: number, defaultCode: string) =>
  class extends AppError {
    constructor(message: string, code = defaultCode, fields?: Record<string, string>) {
      super(message, code, fields);
      this.status = status;
    }
  };

export const BadInput = kind(400, "invalid_input");
export const Unauthorized = kind(401, "unauthorized");
export const Forbidden = kind(403, "forbidden");
export const NotFound = kind(404, "not_found");
export const Conflict = kind(409, "conflict");
