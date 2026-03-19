# PulsePay Frontend

Projeto Expo do app de intermediação de pagamentos Pix, com suporte a Android, iOS e Web pelo mesmo código.

## Rodar localmente

1. Suba a API Go na porta `8080`
2. Defina `EXPO_PUBLIC_API_BASE_URL`
3. Instale dependências e inicie o Expo:

```bash
npm install
npm run start
```

## Scripts

- `npm run start`
- `npm run android`
- `npm run ios`
- `npm run web`

## Configuração

Use [.env.example](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/.env.example) como base:

- `EXPO_PUBLIC_API_BASE_URL`

Para dispositivo físico, use o IP da máquina onde a API Go estiver rodando.

## Estrutura

- [App.js](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/App.js) fluxo principal do app e versão web responsiva
- [app.json](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/app.json) configuração do Expo
- [assets/icon.png](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/assets/icon.png) ícone do app
- [assets/splash.png](/Users/cubevismacbe/Documents/my-projects/payment-front/pulsepay-frontend/assets/splash.png) splash do app
