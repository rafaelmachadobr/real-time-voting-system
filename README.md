# 🗳️ Real-Time Voting System

API de votação em tempo real construída com Node.js, Fastify, PostgreSQL, Redis e WebSocket.

## 📋 Índice

- [Sobre o Projeto](#sobre-o-projeto)
- [Tecnologias](#tecnologias)
- [Arquitetura](#arquitetura)
- [Modelo de Dados](#modelo-de-dados)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Execução](#instalação-e-execução)
- [Variáveis de Ambiente](#variáveis-de-ambiente)
- [Rotas da API](#rotas-da-api)
- [WebSocket](#websocket)
- [Documentação Interativa](#documentação-interativa)

---

## Sobre o Projeto

Sistema que permite criar enquetes, registrar votos e acompanhar os resultados **em tempo real**. Cada usuário é identificado por um cookie de sessão e pode votar apenas uma vez por enquete — mas pode trocar seu voto a qualquer momento.

Os resultados são atualizados instantaneamente para todos os clientes conectados via WebSocket, sem necessidade de polling.

---

## Tecnologias

| Tecnologia                                                         | Versão | Uso                                |
| ------------------------------------------------------------------ | ------ | ---------------------------------- |
| [Node.js](https://nodejs.org/)                                     | 20+    | Runtime                            |
| [TypeScript](https://www.typescriptlang.org/)                      | 5.x    | Tipagem estática                   |
| [Fastify](https://fastify.dev/)                                    | 4.x    | Framework HTTP                     |
| [Prisma](https://www.prisma.io/)                                   | 5.x    | ORM e migrations                   |
| [PostgreSQL](https://www.postgresql.org/)                          | latest | Banco de dados relacional          |
| [Redis](https://redis.io/)                                         | latest | Contagem de votos em tempo real    |
| [ioredis](https://github.com/redis/ioredis)                        | 5.x    | Cliente Redis                      |
| [Zod](https://zod.dev/)                                            | 3.x    | Validação de schemas               |
| [@fastify/websocket](https://github.com/fastify/fastify-websocket) | 10.x   | Suporte a WebSocket                |
| [@fastify/cookie](https://github.com/fastify/fastify-cookie)       | 9.x    | Gerenciamento de sessão via cookie |
| [@fastify/swagger](https://github.com/fastify/fastify-swagger)     | 8.x    | Documentação OpenAPI               |
| [Docker / Docker Compose](https://www.docker.com/)                 | —      | Infraestrutura local               |

---

## Arquitetura

```mermaid
graph TD
    Client["Cliente (HTTP / WebSocket)"]

    Client -->|HTTP REST| Fastify["Fastify\n(porta 3333)"]
    Client <-->|WebSocket| Fastify

    Fastify -->|Prisma ORM| PostgreSQL[("PostgreSQL\nDados persistentes\nenquetes, opções, votos")]
    Fastify -->|ioredis ZINCRBY/ZRANGE| Redis[("Redis\nSorted Set por pollId\ncontagem de votos")]
    Fastify -->|publish/subscribe| PubSub["VotingPubSub\n(in-memory)"]
    PubSub -->|notifica clientes| Client
```

### Fluxo de um voto

1. Cliente envia `POST /polls/:pollId/votes` com o `pollOptionId`
2. Fastify lê (ou cria) o cookie de sessão `sessionId`
3. Verifica no PostgreSQL se o usuário já votou nesta enquete
   - Se votou na **mesma opção** → retorna erro 400
   - Se votou em **outra opção** → remove o voto anterior e decrementa o score no Redis
4. Persiste o novo voto no PostgreSQL via Prisma
5. Incrementa o score da opção votada no Redis (`ZINCRBY`)
6. Publica a atualização no `VotingPubSub`
7. Todos os clientes conectados via WebSocket em `/polls/:pollId/results` recebem o placar atualizado instantaneamente

---

## Modelo de Dados

```prisma
model Poll {
  id        String   @id @default(uuid())
  title     String
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now())
  options   PollOption[]
  votes     Vote[]
}

model PollOption {
  id     String @id @default(uuid())
  title  String
  pollId String
  poll   Poll   @relation(fields: [pollId], references: [id])
  votes  Vote[]
}

model Vote {
  id           Int      @id @default(autoincrement())
  sessionId    String
  pollId       String
  pollOptionId String
  createdAt    DateTime @default(now())

  @@unique([sessionId, pollId]) // um voto por usuário por enquete
}
```

> Os votos são contados no **Redis** (Sorted Sets) para leituras rápidas. O PostgreSQL é a fonte de verdade para os dados persistentes.

---

## Funcionalidades

- ✅ Criação de enquetes com múltiplas opções
- ✅ Votação com controle de sessão por cookie
- ✅ Troca de voto (remove o anterior e registra o novo)
- ✅ Contagem de votos em tempo real via Redis Sorted Sets
- ✅ Transmissão de resultados ao vivo via WebSocket
- ✅ Documentação interativa da API via Swagger UI

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) v20 ou superior
- [Docker](https://www.docker.com/) e Docker Compose

---

## Instalação e Execução

### 1. Clone o repositório

```bash
git clone https://github.com/rafaelmachadobr/real-time-voting-system.git
cd real-time-voting-system
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

```bash
cp .env.example .env
```

Edite o arquivo `.env` com suas configurações (veja [Variáveis de Ambiente](#variáveis-de-ambiente)).

### 4. Suba os serviços com Docker

```bash
docker compose up -d
```

Isso iniciará o **PostgreSQL** na porta `5432` e o **Redis** na porta `6379`.

### 5. Execute as migrations do banco de dados

```bash
npx prisma migrate dev
```

### 6. Inicie o servidor

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3333`.

---

## Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto com o seguinte conteúdo:

```env
DATABASE_URL="postgresql://docker:docker@localhost:5432/polls"
REDIS_URL="redis://localhost:6379"
```

---

## Rotas da API

### Criar enquete

```http
POST /polls
Content-Type: application/json

{
  "title": "Qual é o melhor framework Node.js?",
  "options": ["Fastify", "Express", "Hapi", "Koa"]
}
```

**Resposta:** `201 Created`

```json
{ "pollId": "uuid-da-enquete" }
```

---

### Buscar enquete

```http
GET /polls/:pollId
```

**Resposta:** `200 OK`

```json
{
  "poll": {
    "id": "uuid-da-enquete",
    "title": "Qual é o melhor framework Node.js?",
    "options": [
      { "id": "uuid-opcao-1", "title": "Fastify", "votes": 42 },
      { "id": "uuid-opcao-2", "title": "Express", "votes": 30 },
      { "id": "uuid-opcao-3", "title": "Hapi", "votes": 5 },
      { "id": "uuid-opcao-4", "title": "Koa", "votes": 8 }
    ]
  }
}
```

> A contagem de votos é lida diretamente do Redis para máxima performance.

---

### Votar em uma enquete

```http
POST /polls/:pollId/votes
Content-Type: application/json

{
  "pollOptionId": "uuid-da-opcao"
}
```

**Resposta:** `201 Created`

> Um cookie de sessão `sessionId` é criado automaticamente na primeira votação. Cada sessão pode votar apenas **uma vez** por enquete, mas pode **trocar** seu voto.

---

## WebSocket

### Acompanhar resultados em tempo real

```
ws://localhost:3333/polls/:pollId/results
```

Ao conectar, o cliente passa a receber mensagens JSON sempre que um voto é registrado ou alterado:

```json
{
  "pollOptionId": "uuid-da-opcao",
  "votes": 43
}
```

**Exemplo com JavaScript:**

```javascript
const ws = new WebSocket("ws://localhost:3333/polls/uuid-da-enquete/results");

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log(`Opção ${data.pollOptionId}: ${data.votes} votos`);
};
```

---

## Documentação Interativa

A documentação completa da API está disponível via Swagger UI após iniciar o servidor:

```
http://localhost:3333/docs
```
