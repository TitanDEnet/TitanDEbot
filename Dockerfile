FROM node:20-bullseye-slim

RUN apt-get update && apt-get install -y --fix-missing \
    ffmpeg \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

CMD ["node", "index.js"]
