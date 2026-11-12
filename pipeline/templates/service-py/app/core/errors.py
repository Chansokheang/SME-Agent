"""Errors the services raise, and how every error becomes the same JSON answer:
{"error": {"code", "message"}} (plus "fields" for bad input).

Services raise these (never fastapi.HTTPException): they know the rule, not HTTP."""

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException


class AppError(Exception):
    status = 400
    code = "bad_request"

    def __init__(self, message: str, code: str | None = None, fields: dict | None = None):
        super().__init__(message)
        self.message = message
        self.code = code or self.code
        self.fields = fields


class BadInput(AppError):
    status, code = 400, "invalid_input"


class Unauthorized(AppError):
    status, code = 401, "unauthorized"


class Forbidden(AppError):
    status, code = 403, "forbidden"


class NotFound(AppError):
    status, code = 404, "not_found"


class Conflict(AppError):
    status, code = 409, "conflict"


HTTP_CODES = {400: "invalid_input", 401: "unauthorized", 403: "forbidden", 404: "not_found",
              405: "method_not_allowed", 409: "conflict", 429: "too_many_requests"}


def _body(code: str, message: str, fields: dict | None = None) -> dict:
    error = {"code": code, "message": message}
    if fields:
        error["fields"] = fields
    return {"error": error}


def register(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(_body(exc.code, exc.message, exc.fields), status_code=exc.status)

    # Starlette's HTTPException also covers FastAPI's and unknown addresses (404).
    @app.exception_handler(HTTPException)
    async def http_error(_: Request, exc: HTTPException):
        return JSONResponse(_body(HTTP_CODES.get(exc.status_code, "error"), str(exc.detail)), status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def bad_input(_: Request, exc: RequestValidationError):
        fields = {".".join(str(p) for p in e["loc"][1:]) or "body": e["msg"] for e in exc.errors()}
        return JSONResponse(_body("invalid_input", "Some fields need fixing", fields), status_code=400)

    @app.exception_handler(Exception)
    async def server_error(_: Request, exc: Exception):
        print(f"Error: {exc!r}")
        return JSONResponse(_body("server_error", "Something went wrong."), status_code=500)
