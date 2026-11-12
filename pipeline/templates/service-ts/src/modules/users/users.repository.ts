// Reading and writing users. Prisma queries only: no rules, no HTTP.
// Adjust to the data design's user table (prisma/schema.prisma): its model name and fields.
import { db } from "../../db/prisma.js";

export const usersRepository = {
  findByEmail: (email: string) => db.user.findUnique({ where: { email: email.toLowerCase() } }),
  findById: (id: string) => db.user.findUnique({ where: { id } }),
};
