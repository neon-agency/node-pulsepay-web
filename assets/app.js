const config = window.PULSEPAY_CONFIG || {};

const THEME_ICONS = {
  light: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="4.2"></circle>
      <path d="M12 2.5v2.2M12 19.3v2.2M4.9 4.9l1.6 1.6M17.5 17.5l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.9 19.1l1.6-1.6M17.5 6.5l1.6-1.6"></path>
    </svg>
  `,
  dark: `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a8.2 8.2 0 1 0 9.5 9.5Z"></path>
    </svg>
  `
};

const DEMO_ALWAYS_PASS_LOGIN = "PULSEVIP";
const STEPS = ["Login", "Conta", "Plano", "Pagar"];
const PLANS = [
  { id: "pix-test", name: "Pix de teste", subtitle: "Cobrança para validação", price: 100 },
  { id: "monthly", name: "Mensal", subtitle: "Acesso por 30 dias", price: 3000 },
  { id: "quarterly", name: "Trimestral", subtitle: "Acesso por 90 dias", price: 8000 },
  { id: "semiannual", name: "Semestral", subtitle: "Acesso por 180 dias", price: 14000 },
  { id: "annual", name: "Anual", subtitle: "Acesso por 365 dias", price: 25000 }
];

const state = {
  step: 1,
  route: window.location.pathname, // '/' ou '/gestor'
  managerUser: null,
  managerRoute: "dashboard",
  theme: window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  login: "",
  customer: { name: "", email: "", cpf: "" },
  selectedPlanId: "pix-test",
  accountOverview: null,
  payment: null,
  feedback: null,
  loading: false,
  pollingHandle: null
};

const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function getAccountOverview(loginValue) {
  const normalized = loginValue.trim().toUpperCase();
  if (normalized.startsWith("ATIVO")) {
    return {
      active: true,
      planId: "annual",
      planName: "Anual Premium",
      remainingLabel: "128 dias",
      expiresAt: "24/07/2026",
      status: "Ativo",
      lastPayment: "16/03/2026",
      priceLabel: "R$ 250,00"
    };
  }
  return { active: false };
}

function apiUrl(path) {
  return `${(config.apiBaseUrl || "http://localhost:8080").replace(/\/$/, "")}${path}`;
}

function normalizeCpf(value) {
  return value.replace(/\D/g, "");
}

function qrSource(qrCode) {
  if (!qrCode) return "";
  if (qrCode.startsWith("data:image")) return qrCode;
  if (/^[A-Za-z0-9+/=]+$/.test(qrCode)) return `data:image/png;base64,${qrCode}`;
  return qrCode;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function setFeedback(message, type = "") {
  state.feedback = message ? { message, type } : null;
}

function selectedPlan() {
  return PLANS.find((plan) => plan.id === state.selectedPlanId) || PLANS[0];
}

function panelHeader(index, title, subtitle) {
  return `
    <div class="panel-header">
      <div class="section-badge">${index}</div>
      <div>
        <h1>${title}</h1>
        <p>${subtitle}</p>
      </div>
    </div>
  `;
}

function infoRows(rows) {
  return `
    <div class="info-card">
      ${rows
        .map(
          (row) => `
            <div class="info-row">
              <span>${row.label}</span>
              <strong class="${row.success ? "success" : ""}">${row.value}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function actions(items) {
  return `
    <div class="actions">
      ${items
        .map(
          (item) => `
            <button class="button ${item.variant || "primary"}" id="${item.id}" type="button">
              ${item.label}
            </button>
          `
        )
        .join("")}
    </div>
  `;
}

function renderSteps() {
  const root = document.querySelector("#steps");
  root.innerHTML = STEPS.map((label, index) => {
    const number = index + 1;
    const status = state.step === number ? "active" : state.step > number ? "complete" : "";
    return `
      <div class="step ${status}">
        <div class="step-track">
          <div class="step-dot">${number}</div>
          <div class="step-line"></div>
        </div>
        <div class="step-label">${label}</div>
      </div>
    `;
  }).join("");
}

// --- Manager Views ---

function renderManagerLogin() {
  return `
    <div class="panel-grid">
      ${panelHeader("🔑", "Acesso Gestor", "Identifique-se para acessar o painel de resultados.")}
      <div class="field">
        <label for="manager-user">Usuário</label>
        <input id="manager-user" placeholder="Seu usuário" />
      </div>
      <div class="field">
        <label for="manager-pass">Senha</label>
        <input id="manager-pass" type="password" placeholder="******" />
      </div>
      <button class="button primary full" id="do-manager-login" type="button">Entrar no Painel</button>
      <div class="hint">Acesso restrito a administradores.</div>
    </div>
  `;
}

function renderManagerDashboard() {
  const metrics = { today: "R$ 1.250,00", month: "R$ 15.480,00", actives: 42 };
  return `
    <div class="panel-grid">
      <div class="dashboard-card">
        <div>
          <h2 class="dashboard-title">Olá, ${escapeHtml(state.managerUser.name)}</h2>
          <p>Resultados consolidados das suas renovações.</p>
        </div>
        <div class="stats">
          <div class="stat-card"><span>Hoje</span><strong>${metrics.today}</strong></div>
          <div class="stat-card"><span>Este Mês</span><strong>${metrics.month}</strong></div>
          <div class="stat-card"><span>Ativos</span><strong>${metrics.actives}</strong></div>
        </div>
      </div>
      <div class="panel-header">
        <h2 class="dashboard-title">Vendas Recentes</h2>
      </div>
      ${infoRows([
        { label: "João Silva (Mensal)", value: "R$ 30,00", success: true },
        { label: "Maria Souza (Anual)", value: "R$ 250,00", success: true },
        { label: "Carlos Oliveira (Semestral)", value: "R$ 140,00", success: true }
      ])}
      <div class="actions">
        <button class="button primary" id="go-manager-settings">Configurar Chaves Pix</button>
        <button class="button ghost" id="manager-logout">Sair do Painel</button>
      </div>
    </div>
  `;
}

function renderManagerSettings() {
  return `
    <div class="panel-grid">
      ${panelHeader("⚙️", "Configurações Pix", "Defina suas credenciais para receber pagamentos.")}
      <div class="field">
        <label for="client-id">Client ID (Extrato/EFI)</label>
        <input id="client-id" placeholder="Seu id de produção" />
      </div>
       <div class="field">
        <label for="client-secret">Client Secret</label>
        <input id="client-secret" type="password" placeholder="Sua chave secreta" />
      </div>
      <div class="field">
        <label for="pix-key">Chave Pix Recebedora</label>
        <input id="pix-key" placeholder="CPF, E-mail ou Aleatória" />
      </div>
      <div class="actions">
        <button class="button primary" id="save-settings">Salvar Configurações</button>
        <button class="button ghost" id="back-dashboard">Voltar ao Painel</button>
      </div>
    </div>
  `;
}

// --- Checkout Step Views ---

function renderStepLogin() {
  return `
    <div class="panel-grid">
      ${panelHeader("01", "Localizar conta", "Digite a conta do cliente para continuar o fluxo.")}
      <div class="field">
        <label for="login-input">Número da conta</label>
        <input id="login-input" value="${escapeHtml(state.login)}" placeholder="Ex: 123456 ou PULSEVIP" />
      </div>
      <button class="button primary full" id="next-login" type="button">Continuar</button>
      <div class="hint">Login demo que sempre passa: ${DEMO_ALWAYS_PASS_LOGIN}</div>
    </div>
  `;
}

function renderStepConfirm() {
  return `
    <div class="panel-grid">
      ${panelHeader("02", "Confirmar conta", "Este passo serve apenas para validar se a conta localizada está correta.")}
      ${infoRows([
        { label: "Conta", value: escapeHtml(state.login) },
        { label: "Status", value: "Conta localizada", success: true },
        { label: "Observação", value: "Os detalhes do plano aparecem no próximo passo" }
      ])}
      ${actions([
        { id: "back-1", label: "Voltar", variant: "ghost" },
        { id: "next-2", label: "Confirmar conta", variant: "primary" }
      ])}
    </div>
  `;
}

function renderActivePlan() {
  if (!state.accountOverview?.active) return "";
  return `
    <div class="dashboard-card">
      <div>
        <h2 class="dashboard-title">Plano ativo encontrado</h2>
        <p>Essa conta ainda possui acesso liberado.</p>
      </div>
      <div class="stats">
        <div class="stat-card"><span>Plano</span><strong>${escapeHtml(state.accountOverview.planName)}</strong></div>
        <div class="stat-card"><span>Restante</span><strong>${escapeHtml(state.accountOverview.remainingLabel)}</strong></div>
        <div class="stat-card"><span>Expiração</span><strong>${escapeHtml(state.accountOverview.expiresAt)}</strong></div>
      </div>
    </div>
  `;
}

function renderPlanList() {
  return `
    <div class="plan-list">
      ${PLANS.map(
        (plan) => `
          <button class="plan-card ${state.selectedPlanId === plan.id ? "active" : ""}" type="button" data-plan="${plan.id}">
            <div>
              <span class="plan-title">${escapeHtml(plan.name)}</span>
              <span class="plan-subtitle">${escapeHtml(plan.subtitle)}</span>
            </div>
            <span class="price-chip">${money.format(plan.price / 100)}</span>
          </button>
        `
      ).join("")}
    </div>
  `;
}

function renderStepPlan() {
  return `
    <div class="panel-grid">
      ${panelHeader("03", "Selecionar plano", "Escolha a opção para gerar a cobrança Pix.")}
      ${renderActivePlan()}
      ${renderPlanList()}
      ${actions([
        { id: "back-2", label: "Voltar", variant: "ghost" },
        { id: "next-3", label: "Ir para pagamento", variant: "primary" }
      ])}
    </div>
  `;
}

function renderPaymentResult() {
  if (!state.payment) return "";
  const isPaid = state.payment.status === "paid";
  return `
    <div class="pix-card" style="margin-top: 20px;">
      ${state.payment.qr_code ? `<div class="qr-box"><img src="${qrSource(state.payment.qr_code)}" alt="QR Code Pix" /></div>` : ""}
      <div class="panel-grid" style="margin-top: 14px;">
        ${infoRows([
          { label: "Status", value: isPaid ? "Pagamento confirmado" : "Aguardando pagamento", success: isPaid },
          { label: "Txid", value: escapeHtml(state.payment.provider_id || "-") },
          { label: "Pago em", value: escapeHtml(state.payment.paid_at ? new Date(state.payment.paid_at).toLocaleString("pt-BR") : "-") }
        ])}
        <div class="copy-box" id="copy-box">${escapeHtml(state.payment.copy_paste || "Código indisponível.")}</div>
        ${actions([
          { id: "copy-code", label: "Copiar código", variant: "ghost" },
          { id: "check-status", label: isPaid ? "Confirmado" : "Verificar status", variant: "ghost" },
          { id: "new-payment", label: "Nova recarga", variant: "primary" }
        ])}
      </div>
    </div>
  `;
}

function renderStepPay() {
  const plan = selectedPlan();
  const feedback = state.feedback ? `<p class="feedback ${state.feedback.type}">${escapeHtml(state.feedback.message)}</p>` : "";
  return `
    <div class="panel-grid">
      ${panelHeader("04", "Pagamento Pix", "Gere a cobrança para finalizar.")}
      <div class="field-grid">
        <div class="field"><label for="name">Nome</label><input id="name" value="${escapeHtml(state.customer.name)}" /></div>
        <div class="field"><label for="email">E-mail</label><input id="email" value="${escapeHtml(state.customer.email)}" /></div>
      </div>
      <div class="field"><label for="cpf">CPF</label><input id="cpf" value="${escapeHtml(state.customer.cpf)}" placeholder="000.000.000-00" /></div>
      ${infoRows([
        { label: "Plano", value: escapeHtml(plan.name) },
        { label: "Total", value: money.format(plan.price / 100) }
      ])}
      ${feedback}
      ${actions([
        { id: "back-3", label: "Voltar", variant: "ghost" },
        { id: "pay", label: state.loading ? "Gerando..." : "Gerar Pix", variant: "primary" }
      ])}
      ${renderPaymentResult()}
    </div>
  `;
}

// --- Core Rendering & Logic ---

function renderPanel() {
  const panel = document.querySelector("#panel-content");
  const heroCard = document.querySelector(".hero-card");
  
  if (state.route === "/gestor") {
    heroCard.style.display = "none";
    if (!state.managerUser) {
      panel.innerHTML = renderManagerLogin();
      document.querySelector("#do-manager-login").onclick = () => {
        const u = document.querySelector("#manager-user").value;
        const p = document.querySelector("#manager-pass").value;
        if (u === "admin" && p === "admin") {
          state.managerUser = { name: "Administrador" };
          render();
        } else {
          alert("Acesso negado.");
        }
      };
      return;
    }

    if (state.managerRoute === "settings") {
       panel.innerHTML = renderManagerSettings();
       document.querySelector("#save-settings").onclick = () => {
          alert("Configurações salvas!");
          state.managerRoute = "dashboard";
          render();
       };
       document.querySelector("#back-dashboard").onclick = () => {
          state.managerRoute = "dashboard";
          render();
       };
    } else {
       panel.innerHTML = renderManagerDashboard();
       document.querySelector("#go-manager-settings").onclick = () => {
          state.managerRoute = "settings";
          render();
       };
       document.querySelector("#manager-logout").onclick = () => {
          state.managerUser = null;
          render();
       };
    }
    return;
  }

  heroCard.style.display = "block";
  if (state.step === 1) {
    panel.innerHTML = renderStepLogin();
    document.querySelector("#next-login").onclick = () => {
      const value = document.querySelector("#login-input").value.trim().toUpperCase();
      if (!value) { setFeedback("Informe a conta.", "error"); render(); return; }
      state.login = value;
      state.accountOverview = getAccountOverview(value);
      state.step = 2;
      render();
    };
  } else if (state.step === 2) {
    panel.innerHTML = renderStepConfirm();
    document.querySelector("#back-1").onclick = () => { state.step = 1; render(); };
    document.querySelector("#next-2").onclick = () => { state.step = 3; render(); };
  } else if (state.step === 3) {
    panel.innerHTML = renderStepPlan();
    document.querySelectorAll("[data-plan]").forEach(n => n.onclick = () => { state.selectedPlanId = n.dataset.plan; render(); });
    document.querySelector("#back-2").onclick = () => { state.step = 2; render(); };
    document.querySelector("#next-3").onclick = () => { state.step = 4; render(); };
  } else {
    panel.innerHTML = renderStepPay();
    document.querySelector("#back-3").onclick = () => { state.step = 3; render(); };
    document.querySelector("#pay").onclick = generatePayment;
    if (state.payment) {
      document.querySelector("#copy-code").onclick = copyPixCode;
      document.querySelector("#check-status").onclick = checkPaymentStatus;
      document.querySelector("#new-payment").onclick = () => {
        stopPaymentPolling();
        state.payment = null;
        state.step = 1;
        render();
      };
    }
  }
}

async function copyPixCode() {
  if (!state.payment?.copy_paste) return;
  try {
    await navigator.clipboard.writeText(state.payment.copy_paste);
    setFeedback("Pix copiado!", "success");
  } catch (e) {
    setFeedback("Erro ao copiar.", "error");
  }
  render();
}

async function generatePayment() {
  const plan = selectedPlan();
  state.customer = {
    name: document.querySelector("#name").value.trim(),
    email: document.querySelector("#email").value.trim(),
    cpf: document.querySelector("#cpf").value.trim()
  };
  if (!state.customer.name || !state.customer.email || normalizeCpf(state.customer.cpf).length !== 11) {
    setFeedback("Preencha todos os campos.", "error"); render(); return;
  }
  state.loading = true; render();
  try {
    const res = await fetch(apiUrl("/api/v1/payments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "efi", method: "pix", amount: plan.price, currency: "BRL",
        description: `${plan.name} - ${state.login}`,
        customer: { name: state.customer.name, email: state.customer.email, cpf: normalizeCpf(state.customer.cpf) },
        metadata: { login: state.login, plan_id: plan.id, manager_id: "1" }
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    state.payment = data;
    setFeedback("Pix gerado!", "success");
    startPaymentPolling();
  } catch (err) {
    setFeedback(err.message, "error");
  } finally {
    state.loading = false; render();
  }
}

async function checkPaymentStatus() {
  if (!state.payment?.provider_id) return;

  try {
    const res = await fetch(apiUrl(`/api/v1/payments/efi/${state.payment.provider_id}`));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Não foi possível consultar o status.");

    state.payment = { ...state.payment, ...data };

    if (state.payment.status === "paid") {
      stopPaymentPolling();
      setFeedback("Pagamento confirmado com sucesso.", "success");
    } else {
      setFeedback("Pagamento ainda não confirmado.", "");
    }
  } catch (err) {
    setFeedback(err.message, "error");
  }

  render();
}

function startPaymentPolling() {
  stopPaymentPolling();
  state.pollingHandle = window.setInterval(() => {
    checkPaymentStatus();
  }, 5000);
}

function stopPaymentPolling() {
  if (state.pollingHandle) {
    window.clearInterval(state.pollingHandle);
    state.pollingHandle = null;
  }
}

function syncTheme() {
  document.documentElement.dataset.theme = state.theme;
  document.querySelector("#theme-icon").innerHTML = THEME_ICONS[state.theme];
}

function render() {
  if (state.route === "/gestor") {
    document.querySelector("#steps").innerHTML = "";
  } else {
    renderSteps();
  }
  renderPanel();
  syncTheme();
}

document.querySelector("#theme-toggle").onclick = () => {
  state.theme = state.theme === "dark" ? "light" : "dark";
  syncTheme();
};

window.addEventListener("beforeunload", () => {
  stopPaymentPolling();
});

render();
