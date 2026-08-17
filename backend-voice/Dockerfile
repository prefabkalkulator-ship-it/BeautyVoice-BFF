# Środowisko produkcyjne (Runner)
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN addgroup -g 1001 -S nodejs
RUN adduser -S expressjs -u 1001

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
