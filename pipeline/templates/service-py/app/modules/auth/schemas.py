"""What the auth addresses take and answer (request and response shapes)."""

from pydantic import BaseModel, EmailStr


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    name: str | None = None
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class LoginAnswer(BaseModel):
    data: LoginOut


class MeAnswer(BaseModel):
    data: UserOut
