FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache netcat-openbsd

COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY apps/poller/package.json apps/poller/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/admin-noti-v2/package.json apps/admin-noti-v2/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY packages/database/package.json packages/database/package.json

RUN npm install

COPY . .

RUN npm run prisma:generate -w @publ/database \
  && npm run build -w @publ/shared \
  && npm run build -w @publ/database \
  && npm run build -w @publ/api

CMD ["sh", "docker/start-api.prod.sh"]
