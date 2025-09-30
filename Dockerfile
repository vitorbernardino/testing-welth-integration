# ===============================
# Multi-stage build otimizado
# ===============================

# Stage 1: Build da aplicação
FROM node:20-alpine AS builder

# Labels para metadados
LABEL stage=builder \
      maintainer="Welth Team" \
      description="Welth Finance Management API - Build Stage"

# Instalar dependências do sistema necessárias para compilação
RUN apk add --no-cache python3 make g++ git

# Definir diretório de trabalho
WORKDIR /app

# Copiar arquivos de dependências e configuração primeiro (melhor cache)
COPY package.json yarn.lock tsconfig*.json nest-cli.json ./

# Instalar TODAS as dependências (dev + produção) - apenas uma vez
RUN yarn install --frozen-lockfile

# Copiar código fonte
COPY . .

# Build da aplicação TypeScript
RUN yarn build

# ===============================
# Stage 2: Runtime da aplicação
# ===============================

FROM node:20-alpine AS runtime

# Labels para metadados
LABEL stage=runtime \
      maintainer="Welth Team" \
      description="Welth Finance Management API - Production Runtime"

# Instalar apenas ferramentas necessárias para produção
RUN apk add --no-cache \
    dumb-init \
    curl \
    && rm -rf /var/cache/apk/*

# Criar usuário não-root para segurança
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nestjs -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Criar diretório para arquivos temporários
RUN mkdir -p /tmp && chmod 777 /tmp

# Copiar arquivos essenciais para referência
COPY package.json tsconfig*.json ./

# Copiar node_modules já compilado do builder (contém dev + produção)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# Copiar arquivos compilados do builder
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# Remover apenas os devDependencies do node_modules (mantém produção)
RUN npm prune --production && \
    yarn cache clean && \
    rm -rf /tmp/*

# Alterar ownership de todos os arquivos para o usuário nodejs
RUN chown -R nestjs:nodejs /app

# Trocar para usuário não-root
USER nestjs

# Expor porta da aplicação
EXPOSE 10000

# Definir variáveis de ambiente para produção
ENV NODE_ENV=production \
    PORT=10000 \
    NODE_OPTIONS="--max-old-space-size=4096"

# Healthcheck para monitorar se a aplicação está rodando
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:10000/api/v1/health || exit 1

# Usar dumb-init para gerenciar sinais corretamente
ENTRYPOINT ["/usr/bin/dumb-init", "--"]

# Comando para iniciar a aplicação
CMD ["node", "dist/main"]