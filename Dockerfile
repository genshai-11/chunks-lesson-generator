FROM node:22-slim

WORKDIR /app

# Install deps first (layer cache)
COPY package.json package-lock.json ./
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY server.ts ./
COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["npx", "tsx", "server.ts"]
