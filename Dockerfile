FROM node:20-alpine
WORKDIR /usr/src/app
COPY package.json ./
COPY yarn.lock ./
COPY tsconfig.json ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build
EXPOSE 10000
CMD ["yarn", "start:prod"]