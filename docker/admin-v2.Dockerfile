FROM node:20-alpine

WORKDIR /app

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

ARG NEXT_PUBLIC_API_BASE_URL
ARG NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED

ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED=$NEXT_PUBLIC_LOCAL_PASSWORD_LOGIN_ENABLED

RUN npm run build -w apps/admin-noti-v2

ENV PORT=3010

EXPOSE 3010

CMD ["npm", "run", "start", "-w", "apps/admin-noti-v2", "--", "--hostname", "0.0.0.0", "--port", "3010"]
