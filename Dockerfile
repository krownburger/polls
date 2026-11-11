FROM node:22-alpine

WORKDIR /app

COPY server.js index.html svar.html admin.html ./

ENV PORT=3000
EXPOSE 3000

CMD ["node", "server.js"]
