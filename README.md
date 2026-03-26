  
# PulsePay API - Guia de Integração

Este README documenta as rotas para integração com outra aplicação.

## Base URL
- Produção: `https://pulsepay.webutilidades.online`
- Local: `http://localhost:3001`

## Healthcheck
- `GET /health`

Exemplo:
# Recarga Facil Frontend

Projeto web responsivo para intermediação de pagamentos Pix.

## Rodar localmente

1. Suba a API Go
2. Configure `FRONTEND_API_BASE_URL`
3. Rode:

```bash
curl -X GET "https://pulsepay.webutilidades.online/health"
```

## Autenticação

Existem 2 formas:

1. `Authorization: Bearer <token>` (obtido no login)
2. `x-internal-api-key: <INTERNAL_API_KEY>` (integração interna)

## 1) Login

- `POST /api/auth/login`
- Público

Body:
```json
{
  "email": "admin@pulsepay.com",
  "password": "pulsepay123"
}
```

Exemplo:
```bash
curl -X POST "https://pulsepay.webutilidades.online/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@pulsepay.com","password":"pulsepay123"}'
```

Resposta esperada:
```json
{
  "token": "....",
  "expiresAt": "2026-03-27T01:23:45.000Z",
  "user": {
    "email": "admin@pulsepay.com"
  }
}
```

## 2) Servers

### Listar servidores
- `GET /api/servers`
- Público

Exemplo:
```bash
curl -X GET "https://pulsepay.webutilidades.online/api/servers"
```

### Buscar servidor por ID
- `GET /api/servers/:id`
- Público

Exemplo:
```bash
curl -X GET "https://pulsepay.webutilidades.online/api/servers/1"
```

### Criar servidor
- `POST /api/servers`
- Protegido

Body:
```json
{
  "servidor": "UNITV"
}
```

Exemplo (Bearer):
```bash
curl -X POST "https://pulsepay.webutilidades.online/api/servers" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"servidor":"UNITV"}'
```

### Atualizar servidor
- `PUT /api/servers/:id`
- Protegido

Body:
```json
{
  "servidor": "NOVO_NOME"
}
```

Exemplo:
```bash
curl -X PUT "https://pulsepay.webutilidades.online/api/servers/1" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"servidor":"NOVO_NOME"}'
```

### Deletar servidor
- `DELETE /api/servers/:id`
- Protegido

Exemplo:
```bash
curl -X DELETE "https://pulsepay.webutilidades.online/api/servers/1" \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 3) Clients

Todas as rotas de clients são protegidas.

### Listar clients
- `GET /api/clients`

```bash
curl -X GET "https://pulsepay.webutilidades.online/api/clients" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Buscar client por ID
- `GET /api/clients/:id`

```bash
curl -X GET "https://pulsepay.webutilidades.online/api/clients/CLIENT_ID" \
  -H "Authorization: Bearer SEU_TOKEN"
```

### Criar client
- `POST /api/clients`

Body:
```json
{
  "nome": "João Silva",
  "email": "joao@email.com",
  "servidor": "1",
  "plano": "Mensal",
  "status": "ativo",
  "vencimento": "2026-04-10"
}
```

```bash
curl -X POST "https://pulsepay.webutilidades.online/api/clients" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"nome":"João Silva","email":"joao@email.com","servidor":"1","plano":"Mensal","status":"ativo","vencimento":"2026-04-10"}'
```

### Atualizar client
- `PUT /api/clients/:id`

```bash
curl -X PUT "https://pulsepay.webutilidades.online/api/clients/CLIENT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"status":"suspenso"}'
```

### Deletar client
- `DELETE /api/clients/:id`

```bash
curl -X DELETE "https://pulsepay.webutilidades.online/api/clients/CLIENT_ID" \
  -H "Authorization: Bearer SEU_TOKEN"
```

## 4) Dashboard

Rota para alimentar os cards e distribuições do painel.

- `GET /api/dashboard`
- Protegida

Exemplo:
```bash
curl -X GET "https://pulsepay.webutilidades.online/api/dashboard" \
  -H "Authorization: Bearer SEU_TOKEN"
```

Resposta (estrutura):
```json
{
  "cards": {
    "totalClientes": {
      "total": 0,
      "ativos": 0
    },
    "receitaTotal": {
      "total": 0,
      "currency": "BRL"
    },
    "alertasCriticos": {
      "total": 0,
      "descricao": "Vencem em até 7 dias"
    },
    "taxaRenovacao": {
      "percentual": 0,
      "periodoDias": 30
    }
  },
  "distribuicaoPorServidor": [
    {
      "serverId": "1",
      "servidor": "UNITV",
      "clientes": 0,
      "percentual": 0
    }
  ],
  "distribuicaoDePlanos": [
    {
      "plano": "Mensal",
      "clientes": 0,
      "receitaTotal": 0,
      "percentual": 0
    }
  ],
  "statusDeVencimento": {
    "critico": {
      "total": 0,
      "label": "Até 7 dias"
    },
    "atencao": {
      "total": 0,
      "label": "Até 30 dias"
    },
    "ok": {
      "total": 0,
      "label": "Acima de 30 dias"
    }
  }
}
```

## Erros comuns

Formato:
```json
{
  "message": "Descrição do erro"
}
```

Mensagens frequentes:
- `Token não informado`
- `Token inválido ou expirado`
- `Servidor informado não existe`
- `Já existe cliente com esse email`

## Fluxo recomendado de integração

1. Fazer login em `/api/auth/login`
2. Salvar `token`
3. Ler servidores via `/api/servers`
4. Criar/editar/deletar clients usando `Authorization: Bearer <token>`
