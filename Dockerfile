FROM oven/bun:1.1-alpine@sha256:ae1ee3f0e326ad8ae886bd500929e7f4fcb4986a1455d6d6ab2f3c2498036aad AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM deps AS build
COPY tsconfig.json ./
COPY src ./src
RUN bun run build

FROM oven/bun:1.1-alpine@sha256:ae1ee3f0e326ad8ae886bd500929e7f4fcb4986a1455d6d6ab2f3c2498036aad AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=build /app/dist ./dist
USER bun
EXPOSE 3000
CMD ["bun", "run", "start"]
