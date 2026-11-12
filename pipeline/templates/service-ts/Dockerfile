# Runs the API on your own server (Docker). Online on Vercel, api/index.ts is used instead.
FROM node:20-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm install --no-audit --no-fund
COPY . .
ENV NODE_ENV=production PORT=8000
EXPOSE 8000
CMD ["npx", "tsx", "src/server.ts"]
