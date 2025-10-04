# apps/server/Dockerfile
FROM node:20-alpine
WORKDIR /app
# only copy server + shared (keep image small)
COPY ../../packages/shared ./packages/shared
COPY . .
RUN npm i -g pnpm@9 && pnpm i --prod --filter monopolytr-server... && pnpm -C . build
EXPOSE 8787
CMD ["node", "dist/server.js"]
