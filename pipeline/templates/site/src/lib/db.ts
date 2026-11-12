import { PrismaClient } from "@prisma/client";

// One client per server process (Next.js dev reloads would otherwise open a new one each time).
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
