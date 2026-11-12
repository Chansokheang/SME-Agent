// Sign-in rules. Takes plain values, throws lib/errors; knows nothing about HTTP (no Context),
// so any route, script or test can call it.
import { NotFound, Unauthorized } from "../../lib/errors.js";
import { checkPassword, signToken } from "../../lib/security.js";
import { usersRepository } from "../users/users.repository.js";
import type { UserOut } from "./auth.schemas.js";

type UserRow = { id: string | number; email: string; name?: string | null; role?: string | null };

const toOut = (user: UserRow): UserOut => ({
  id: String(user.id),
  email: user.email,
  name: user.name ?? null,
  role: user.role ?? "user",
});

export const authService = {
  async login(email: string, password: string) {
    const user = await usersRepository.findByEmail(email);
    if (!user || !(await checkPassword(password, user.passwordHash))) {
      throw new Unauthorized("Email or password is incorrect", "wrong_credentials");
    }
    const out = toOut(user);
    return { token: await signToken({ userId: out.id, role: out.role }), user: out };
  },

  async me(userId: string) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new NotFound("This account no longer exists");
    return toOut(user);
  },
};
