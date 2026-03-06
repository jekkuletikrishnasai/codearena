# Lightweight — fits Render free tier (512MB RAM)
FROM node:18-alpine

RUN apk add --no-cache \
    python3 \
    gcc \
    g++ \
    musl-dev \
    openjdk17-jre

WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .

EXPOSE 5000
CMD ["sh", "-c", "node src/db/setup.js && node src/server.js"]
