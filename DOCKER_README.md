# Docker Setup para Welth API

Este projeto inclui arquivos Docker configurados para facilitar o deploy da aplicação NestJS.

## Arquivos Criados

- **`Dockerfile`** - Multi-stage build otimizado para produção
- **`.dockerignore`** - Arquivos excluídos do contexto de build
- **`docker-compose.yml`** - Configuração para desenvolvimento com Docker

## Como usar

### Build e execução básica

```bash
# Build da imagem
docker build -t welth-api .

# Execução do container
docker run -p 10000:10000 --env-file .env welth-api
```

### Usando Docker Compose (recomendado)

```bash
# Iniciar aplicação
docker-compose up -d

# Ver logs
docker-compose logs -f app

# Parar aplicação
docker-compose down
```

### Para produção

```bash
# Build para produção
docker build -t welth-api:prod .

# Executar com variáveis de ambiente
docker run -d \
  --name welth-api \
  -p 10000:10000 \
  -e NODE_ENV=production \
  -e MONGODB_URI=mongodb://your-mongo-uri \
  -e JWT_SECRET=your-secret \
  --restart unless-stopped \
  welth-api:prod
```

## Variáveis de Ambiente Necessárias

Crie um arquivo `.env` baseado no `.env.example`:

```bash
cp .env.example .env
```

Configure as seguintes variáveis no arquivo `.env`:

- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=mongodb://localhost:27017/welth`
- `JWT_SECRET=seu-secret-aqui`

## Recursos do Dockerfile

- ✅ **Multi-stage build** para reduzir tamanho da imagem
- ✅ **Usuário não-root** para segurança
- ✅ **Alpine Linux** para imagem menor
- ✅ **Dumb-init** para gerenciamento correto de sinais
- ✅ **Cache de dependências** otimizado
- ✅ **Build de produção** apenas
- ✅ **Dependências pré-compiladas** copiadas entre stages para evitar recompilação
- ✅ **Healthcheck integrado** para monitoramento automático
- ✅ **Arquivos essenciais** copiados corretamente para evitar erros de build

## Portas

- **Aplicação**: 10000 (porta padrão do projeto)

## Health Check

A aplicação inclui um endpoint de health check em `/api/v1/health` que retorna:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.456
}
```

O Docker configura automaticamente um healthcheck que verifica este endpoint a cada 30 segundos.

## Logs

Os logs da aplicação ficam disponíveis através do comando:

```bash
docker-compose logs -f app
```
