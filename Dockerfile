# Multi-stage build para otimização
# Stage 1: Build da aplicação
FROM node:20-alpine AS builder

# Instalar dependências do sistema necessárias para compilação
RUN apk add --no-cache python3 make g++

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências
COPY package.json yarn.lock ./

# Instalar dependências (incluindo devDependencies para build)
RUN yarn install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build da aplicação
RUN yarn build

# Stage 2: Runtime da aplicação
FROM node:20-alpine AS runtime

# Instalar dependências de produção apenas
RUN apk add --no-cache dumb-init

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar package.json e yarn.lock
COPY package.json yarn.lock ./

# Instalar apenas dependências de produção
RUN yarn install --frozen-lockfile --production && \
    yarn cache clean

# Copiar arquivos compilados do stage anterior
COPY --from=builder /app/dist ./dist

# Alterar ownership dos arquivos para o usuário nodejs
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expor porta da aplicação
EXPOSE 10000

# Definir variável de ambiente para produção
ENV NODE_ENV=production

# Usar dumb-init para gerenciar sinais corretamente
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]
