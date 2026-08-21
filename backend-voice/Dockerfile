# Środowisko produkcyjne (Runner)
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN groupadd -g 1001 nodejs
RUN useradd -m -u 1001 -g nodejs expressjs

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

RUN npm ci --omit=dev
RUN npm install tsx prisma

RUN npx prisma generate

COPY ./src ./src
RUN chown -R expressjs:nodejs /app

USER expressjs

EXPOSE 8080

CMD ["npx", "tsx", "src/index.ts"]
