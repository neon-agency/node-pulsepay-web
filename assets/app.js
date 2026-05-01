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
const STEPS = ["Login", "Dados", "Plano", "Pagar"];
const CHECKOUT_PATHS = new Set(["/checkout", "/checkout/"]);
const PLANS = [
  { id: "pix-test", name: "Degustacao", subtitle: "1 dia", price: 100 },
  { id: "monthly", name: "Mensal", subtitle: "30 dias", price: 3000 },
  { id: "quarterly", name: "Trimestral", subtitle: "90 dias", price: 8000 },
  { id: "semiannual", name: "Semestral", subtitle: "180 dias", price: 14000 },
  { id: "annual", name: "Anual", subtitle: "365 dias", price: 25000 }
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

function buildCheckoutCustomer() {
  if (state.customer.name && state.customer.email && normalizeCpf(state.customer.cpf).length === 11) {
    return {
      name: state.customer.name,
      email: state.customer.email,
      cpf: normalizeCpf(state.customer.cpf)
    };
  }

  const normalizedLogin = (state.login || DEMO_ALWAYS_PASS_LOGIN).trim().toUpperCase();
  const safeLogin = normalizedLogin || DEMO_ALWAYS_PASS_LOGIN;

  return {
    name: safeLogin === DEMO_ALWAYS_PASS_LOGIN ? "Cliente PulseVIP" : `Cliente ${safeLogin}`,
    email: `${safeLogin.toLowerCase()}@recargafacil.com`,
    cpf: "55873283842"
  };
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

function renderLandingPage() {
  const root = document.querySelector(".page-content");
  root.innerHTML = `
    <section class="landing-hero">
      <div class="landing-copy">
        <span class="hero-kicker">Sistema completo para provedores e revendedores</span>
        <h1>Venda recargas no Pix com menos trabalho manual.</h1>
        <p>
          O PulsePay organiza clientes, planos, chaves Pix, comprovantes e renovacoes em uma experiencia simples para quem vende e para quem compra.
        </p>
        <div class="hero-actions">
          <a class="button primary" href="https://wa.me/5500000000000?text=Quero%20uma%20demonstracao%20do%20PulsePay">Quero vender mais</a>
          <a class="button ghost" href="/checkout">Ver demo do checkout</a>
        </div>
        <div class="trust-row" aria-label="Diferenciais principais">
          <span>Pix integrado</span>
          <span>Gestao de clientes</span>
          <span>Automacao via WhatsApp</span>
        </div>
      </div>

      <div class="product-preview" aria-label="Previa do painel PulsePay">
        <div class="preview-topbar">
          <span></span><span></span><span></span>
        </div>
        <div class="preview-metrics">
          <div>
            <small>Vendas hoje</small>
            <strong>R$ 1.250</strong>
          </div>
          <div>
            <small>Clientes ativos</small>
            <strong>42</strong>
          </div>
        </div>
        <div class="preview-list">
          <div><span>Joao Silva</span><strong>Pix aprovado</strong></div>
          <div><span>Maria Souza</span><strong>Plano renovado</strong></div>
          <div><span>Carlos Lima</span><strong>Comprovante recebido</strong></div>
        </div>
      </div>
    </section>

    <section class="landing-section compact-section" id="beneficios">
      <div class="section-heading">
        <span class="hero-kicker">Por que usar</span>
        <h2>Mais controle para sua operacao, mais facilidade para o cliente.</h2>
      </div>
      <div class="feature-grid">
        <article class="feature-card">
          <div class="feature-icon">Pix</div>
          <h3>Cobranca rapida</h3>
          <p>Checkout responsivo com QR Code, copia e cola e acompanhamento do status do pagamento.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">CRM</div>
          <h3>Clientes organizados</h3>
          <p>Cadastre clientes, acompanhe planos e veja quem precisa renovar sem depender de planilhas soltas.</p>
        </article>
        <article class="feature-card">
          <div class="feature-icon">Bot</div>
          <h3>Atendimento automatizado</h3>
          <p>Fluxos de recarga e avisos pelo WhatsApp ajudam a reduzir tarefas repetitivas.</p>
        </article>
      </div>
    </section>

    <section class="landing-section split-section" id="como-funciona">
      <div class="section-heading">
        <span class="hero-kicker">Fluxo simples</span>
        <h2>Da escolha do plano ao Pix confirmado.</h2>
      </div>
      <div class="timeline">
        <div><span>01</span><p>Cliente informa a conta ou fala com o bot.</p></div>
        <div><span>02</span><p>Escolhe o plano ideal e gera o Pix.</p></div>
        <div><span>03</span><p>Gestor acompanha recargas, comprovantes e resultados.</p></div>
      </div>
    </section>

    <section class="landing-cta">
      <div>
        <span class="hero-kicker">Pronto para vender melhor</span>
        <h2>Coloque suas recargas em um sistema com cara profissional.</h2>
        <p>Fale com a gente e veja como o PulsePay pode entrar na sua operacao.</p>
      </div>
      <a class="button primary" href="https://wa.me/5500000000000?text=Quero%20contratar%20o%20PulsePay">Chamar no WhatsApp</a>
    </section>
  `;
}

function renderSteps() {
  const root = document.querySelector("#steps");
  if (!root) return;
  root.innerHTML = STEPS.map((label, index) => {
    const number = index + 1;
    const status = state.step === number ? "active" : state.step > number ? "complete" : "";
    return `
      <div class="step ${status}">
        <div class="step-track">
          <div class="step-dot">${number}</div>
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
      ${panelHeader("01", "Recarga de Conta", "Informe o numero da conta para iniciar a recarga.")}
      <div class="field">
        <label for="login-input">Numero da conta</label>
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
      ${panelHeader("02", "Confirmar", "Confira se esta e a conta correta antes de continuar.")}
      ${infoRows([
        { label: "Conta", value: escapeHtml(state.login) },
        { label: "Status", value: "Conta localizada", success: true },
        { label: "Plano atual", value: state.accountOverview?.active ? "Assinatura ativa" : "Assinatura inativa" }
      ])}
      ${actions([
        { id: "back-1", label: "Voltar", variant: "ghost" },
        { id: "next-2", label: "Confirmar", variant: "primary" }
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
            <div class="plan-copy">
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
      ${panelHeader("03", "Escolha o plano", "Selecione a opcao ideal para o cliente.")}
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
        <button class="button primary full" id="copy-code" type="button">Copiar codigo Pix</button>
        ${actions([
          { id: "share-code", label: "Compartilhar", variant: "primary" },
          { id: "check-status", label: isPaid ? "Confirmado" : "Status", variant: "ghost" }
        ])}
        <button class="button ghost full" id="new-payment" type="button">Nova recarga</button>
      </div>
    </div>
  `;
}

function renderStepPay() {
  const plan = selectedPlan();
  const feedback = state.feedback ? `<p class="feedback ${state.feedback.type}">${escapeHtml(state.feedback.message)}</p>` : "";
  return `
    <div class="panel-grid">
      ${panelHeader("04", "Pagamento Pix", "Escaneie o QR Code ou use o codigo copia e cola.")}
      ${infoRows([
        { label: "Plano", value: escapeHtml(plan.name) },
        { label: "Login", value: escapeHtml(state.login) },
        { label: "Total", value: money.format(plan.price / 100), success: true }
      ])}
      ${state.loading ? `<p class="payment-loading">Gerando pagamento...</p>` : ""}
      ${feedback}
      ${!state.payment ? actions([
        { id: "back-3", label: "Voltar", variant: "ghost" }
      ]) : ""}
      ${renderPaymentResult()}
    </div>
  `;
}

function openStepPay() {
  state.step = 4;
  state.payment = null;
  setFeedback(null);
  render();
  generatePayment();
}

// --- Core Rendering & Logic ---

function renderPanel() {
  const panel = document.querySelector("#panel-content");
  const heroCard = document.querySelector(".hero-card");

  if (!CHECKOUT_PATHS.has(state.route) && state.route !== "/gestor") {
    renderLandingPage();
    return;
  }
  
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
    document.querySelector("#next-3").onclick = () => { openStepPay(); };
  } else {
    panel.innerHTML = renderStepPay();
    const backButton = document.querySelector("#back-3");
    if (backButton) {
      backButton.onclick = () => { stopPaymentPolling(); state.step = 3; state.loading = false; render(); };
    }
    if (state.payment) {
      document.querySelector("#copy-code").onclick = copyPixCode;
      document.querySelector("#share-code").onclick = sharePixCode;
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

async function sharePixCode() {
  if (!state.payment?.copy_paste) return;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "Codigo Pix",
        text: state.payment.copy_paste
      });
      setFeedback("Codigo Pix compartilhado.", "success");
    } else {
      await navigator.clipboard.writeText(state.payment.copy_paste);
      setFeedback("Compartilhamento indisponivel. Codigo Pix copiado.", "success");
    }
  } catch (e) {
    setFeedback("Nao foi possivel compartilhar o codigo Pix.", "error");
  }

  render();
}

async function generatePayment() {
  const plan = selectedPlan();
  const checkoutCustomer = buildCheckoutCustomer();

  state.customer = {
    name: checkoutCustomer.name,
    email: checkoutCustomer.email,
    cpf: checkoutCustomer.cpf
  };

  state.loading = true;
  setFeedback(null);
  render();

  try {
    const res = await fetch(apiUrl("/api/v1/payments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "efi", method: "pix", amount: plan.price, currency: "BRL",
        description: `${plan.name} - ${state.login}`,
        pix_key: config.pixKey,
        customer: { name: checkoutCustomer.name, email: checkoutCustomer.email, cpf: checkoutCustomer.cpf },
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
      showSuccess();
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
  document.body.dataset.page = CHECKOUT_PATHS.has(state.route)
    ? "checkout"
    : state.route === "/gestor"
      ? "gestor"
      : "landing";

  if (state.route === "/gestor") {
    const steps = document.querySelector("#steps");
    if (steps) steps.innerHTML = "";
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

function showSuccess() {
  const overlay = document.querySelector("#success-overlay");
  if (overlay) overlay.classList.remove("hidden");
}

function closeSuccessOverlay() {
  const overlay = document.querySelector("#success-overlay");
  if (overlay) overlay.classList.add("hidden");
}

window.closeSuccessOverlay = closeSuccessOverlay;
window.addEventListener("beforeunload", () => {
  stopPaymentPolling();
});

render();
