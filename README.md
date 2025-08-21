# Welth Backend

## Descrição

Backend para sistema de gestão financeira pessoal desenvolvido em NestJS com MongoDB.

## Características Principais

- **Arquitetura Modular**: Organizado em módulos especializados
- **Autenticação JWT**: Sistema seguro de autenticação
- **Importação de Extratos**: Suporte para CSV e PDF
- **Cálculos Dinâmicos**: Engine de cálculo para projeções financeiras
- **API Externa**: Integração com APIs de investimento
- **Event-Driven**: Sistema de eventos para atualizações automáticas

## Módulos

### 1. Auth Module
- Registro e login de usuários
- JWT tokens
- Middleware de autenticação

### 2. Users Module
- Gestão de perfis de usuário
- Operações CRUD de usuários

### 3. Transactions Module
- CRUD de transações
- Transações recorrentes
- Filtros e busca
- Categorização automática

### 4. Spreadsheet Module
- Visualização de planilhas mensais
- Cálculos de projeção
- Saldos dinâmicos

### 5. Emergency Reserve Module
- Gestão de reserva de emergência
- Projeções de rentabilidade
- Metas de contribuição

### 6. File Import Module
- Importação de extratos bancários
- Parsing de CSV e PDF
- Categorização automática

### 7. Investment Module
- Integração com APIs externas
- Taxas de investimento atualizadas
- Cálculos de rentabilidade

### 8. Calculation Engine Module
- Motor de cálculo centralizado
- Event listeners para atualizações
- Projeções futuras

## Design Patterns Utilizados

### 1. Repository Pattern
- Abstração da camada de dados
- Facilita testes unitários

### 2. Observer Pattern
- Sistema de eventos para atualizações
- Desacoplamento entre módulos

### 3. Strategy Pattern
- Diferentes estratégias de parsing (CSV/PDF)
- Categorizações automáticas

### 4. Factory Pattern
- Criação de objetos baseada em tipo
- Processamento de diferentes formatos

### 5. Dependency Injection
- Inversão de controle
- Testabilidade melhorada

## Instalação e Execução

```bash
# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env

# Executar em desenvolvimento
npm run start:dev

# Executar em produção
npm run build
npm run start:prod
```

## Estrutura do Banco de Dados

### Índices Otimizados
- Compostos para consultas eficientes
- Unique constraints para integridade

### Agregações
- Pipeline de agregação para relatórios
- Cálculos estatísticos otimizados

## API Endpoints

### Auth
- `POST /api/v1/auth/register` - Registro
- `POST /api/v1/auth/login` - Login

### Transactions
- `GET /api/v1/transactions` - Listar transações
- `POST /api/v1/transactions` - Criar transação
- `PUT /api/v1/transactions/:id` - Atualizar transação
- `DELETE /api/v1/transactions/:id` - Deletar transação

### Spreadsheet
- `GET /api/v1/spreadsheet/:year/:month` - Dados mensais
- `POST /api/v1/spreadsheet/recalculate` - Recalcular

### File Import
- `POST /api/v1/import/upload` - Upload de extrato
- `GET /api/v1/import/history` - Histórico de importações

## Segurança

- Validação de entrada com class-validator
- Sanitização de dados
- Rate limiting
- CORS configurado
- Autenticação JWT obrigatória

## Performance

- Índices de banco otimizados
- Agregações eficientes
- Cache de cálculos pesados
- Processamento assíncrono

## Monitoramento

- Logs estruturados
- Health checks
- Métricas de performance
- Error tracking