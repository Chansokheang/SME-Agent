FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# Baked into the client bundle at build time: the URL the *browser* uses to reach the backend.
ARG NEXT_PUBLIC_API_URL=http://localhost:8001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build

FROM node:22-alpine
WORKDIR /app
# HOSTNAME is where it listens: 127.0.0.1 keeps it on the server itself (reached through an SSH
# tunnel); compose sets it from BIND_HOST.
ENV NODE_ENV=production PORT=3000 HOSTNAME=127.0.0.1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
