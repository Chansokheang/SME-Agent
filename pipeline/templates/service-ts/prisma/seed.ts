// Realistic sample data and one test account per role (written in Stage 4).
// Passwords with hashPassword from src/lib/security.ts.
import { db } from "../src/db/prisma.js";

async function main() {}

main().finally(() => db.$disconnect());
