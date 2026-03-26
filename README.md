



# Recarga Facil Frontend

Projeto web responsivo para intermediação de pagamentos Pix.

## Rodar localmente

1. Suba a API Go
2. Configure `FRONTEND_API_BASE_URL`
3. Rode:

```bash
npm run dev
```

## Scripts

- `npm run dev`
- `npm run start`

## Estrutura

- [index.html](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/index.html)
- [privacy.html](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/privacy.html)
- [assets/styles.css](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/assets/styles.css)
- [assets/app.js](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/assets/app.js)
- [server.js](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/server.js)

## Observacoes

- `PULSEVIP` passa no fluxo e nao possui plano ativo
- contas iniciadas com `ATIVO` exibem resumo de plano ativo na etapa de plano
- existe um plano de teste de `R$ 1,00` para validar a geracao do Pix
