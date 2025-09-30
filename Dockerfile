# Estágio 1: Build da Aplicação
# Usamos uma imagem Node.js com Alpine para um tamanho menor.
FROM node:20-alpine AS builder

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia os arquivos de gerenciamento de dependências
COPY package.json yarn.lock tsconfig.json ./

# Instala as dependências do projeto usando Yarn
RUN yarn install --frozen-lockfile

# Copia o restante do código-fonte da aplicação
COPY . .

# Executa o script de build definido no package.json
RUN yarn build

# Estágio 2: Produção
# Usamos a mesma imagem base para consistência
FROM node:20-alpine

# Define o diretório de trabalho
WORKDIR /usr/src/app

# Copia os arquivos de dependência novamente
COPY package.json yarn.lock tsconfig.json ./

# Instala SOMENTE as dependências de produção para otimizar o tamanho da imagem
RUN yarn install --production --frozen-lockfile

# Copia os arquivos compilados do estágio de 'builder'
COPY --from=builder /usr/src/app/dist ./dist

# Expõe a porta em que a aplicação será executada, conforme definido em src/main.ts
EXPOSE 10000

# Define o comando para iniciar a aplicação em modo de produção
CMD ["node", "dist/main"]