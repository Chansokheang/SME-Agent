# Website

Built with Gagesite: Next.js (App Router), TypeScript, Tailwind CSS, Prisma.

## Run it locally

```bash
cp .env.example .env
npm install
npx prisma db push
npm run db:seed
npm run dev
```

Then open http://localhost:3000.

## Production

Set `DATABASE_URL` to your Postgres connection string in your hosting provider's
settings, and change `provider = "sqlite"` to `provider = "postgresql"` in
`prisma/schema.prisma`.
