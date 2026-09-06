# Środowisko produkcyjne (Runner)
FROM node:22-slim AS runner

WORKDIR /app

RUN groupadd -g 1001 nodejs
RUN useradd -m -u 1001 -g nodejs expressjs

COPY package*.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma

# Instalacja zależności produkcyjnych
RUN npm ci --omit=dev

# Instalujemy tsx i prisma jawnie. Używamy flagi, żeby NODE_ENV=production nam tego nie blokował
RUN npm install tsx prisma --no-save

# Generowanie klienta Prisma
RUN npx prisma generate

COPY ./src ./src
RUN chown -R expressjs:nodejs /app

USER expressjs
EXPOSE 8080

# Dopiero tutaj ustawiamy tryb produkcyjny
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
