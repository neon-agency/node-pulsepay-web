import { PLANS } from "../constants/plans";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || "http://localhost:8080";

export const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL"
});

export function normalizeCpf(value) {
  return value.replace(/\D/g, "");
}

export function qrSource(qrCode) {
  if (!qrCode) return null;
  if (qrCode.startsWith("data:image")) return { uri: qrCode };
  if (qrCode.startsWith("http://") || qrCode.startsWith("https://")) return { uri: qrCode };
  if (/^[A-Za-z0-9+/=]+$/.test(qrCode)) return { uri: `data:image/png;base64,${qrCode}` };
  return null;
}

export function apiUrl(pathname) {
  return `${API_BASE_URL.replace(/\/$/, "")}${pathname}`;
}

export async function createPixPayment({ login, customer, planId }) {
  const plan = PLANS.find((item) => item.id === planId) || PLANS[0];
  const payload = {
    provider: "efi",
    method: "pix",
    amount: plan.price,
    currency: "BRL",
    description: `${plan.name} - ${login}`,
    customer: {
      name: customer.name,
      email: customer.email,
      cpf: normalizeCpf(customer.cpf)
    },
    items: [
      {
        name: `Plano ${plan.name}`,
        value: plan.price,
        amount: 1,
        description: plan.subtitle
      }
    ],
    metadata: {
      login,
      plan_id: plan.id
    }
  };

  const response = await fetch(apiUrl("/api/v1/payments"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Nao foi possivel gerar o Pix.");
  }

  return data;
}

export async function fetchPixStatus(providerId) {
  const response = await fetch(apiUrl(`/api/v1/payments/efi/${providerId}`));
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Nao foi possivel consultar o status.");
  }

  return data;
}
