// Password hashing and sign-in tokens (JWT, sent as "Authorization: Bearer <token>"). No HTTP here.
import bcrypt from "bcryptjs";
import { jwtVerify, SignJWT } from "jose";
import { env } from "../config/env.js";

export type TokenUser = { userId: string; role: string };

function secret() {
  if (!env.jwtSecret) throw new Error("SERVICE_JWT_SECRET is not set");
  return new TextEncoder().encode(env.jwtSecret);
}

export const hashPassword = (password: string) => bcrypt.hash(password, 10);
export const checkPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

export async function signToken(user: TokenUser) {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${env.tokenDays}d`)
    .sign(secret());
}

/** The token's user, or null when it is missing, wrong or expired. */
export async function readToken(token: string): Promise<TokenUser | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return { userId: String(payload.userId), role: String(payload.role) };
  } catch {
    return null;
  }
}
