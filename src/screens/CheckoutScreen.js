import React from "react";
import { Image, Platform, Pressable, Text, TextInput, View } from "react-native";
import { PLANS } from "../constants/plans";
import { currency } from "../lib/paymentApi";
import { StepPills } from "../components/StepPills";
import { Button, Feature, Field, InfoCard, PanelHeader } from "../components/ui";

export function CheckoutScreen({
  styles,
  isWide,
  step,
  login,
  setLogin,
  customer,
  setCustomer,
  selectedPlan,
  selectedPlanId,
  setSelectedPlanId,
  accountOverview,
  payment,
  paymentQr,
  loading,
  feedback,
  onPrivacy,
  onLoginNext,
  onCustomerNext,
  onGeneratePix,
  onStatusCheck,
  onSharePixCode,
  onReset,
  setStep
}) {
  const checkoutCard = (
    <View style={[styles.checkoutCard, isWide && styles.checkoutCardWide]}>
      <View style={styles.checkoutInner}>
        <View style={styles.heroRow}>
          <Text style={styles.heroTitle}>Recarga de planos com Pix</Text>
          <Text style={styles.heroCopy}>
            Um fluxo mais limpo, confiavel e moderno para renovar planos com pagamento instantaneo.
          </Text>
        </View>

        <StepPills styles={styles} currentStep={step} />

        <View style={styles.panel}>
          {step === 1 && (
            <>
              <PanelHeader styles={styles} index="01" title="Recarga de Conta" subtitle="Informe o numero da conta para iniciar a recarga." />
              <Field styles={styles} label="Numero da conta">
                <TextInput
                  value={login}
                  onChangeText={setLogin}
                  placeholder="Ex: 123456"
                  placeholderTextColor="#94a0b1"
                  autoCapitalize="characters"
                  style={styles.input}
                />
              </Field>
              <Button styles={styles} label="Continuar" onPress={onLoginNext} />
              <Text style={styles.demoHint}>Login demo que sempre passa: PULSEVIP</Text>
            </>
          )}

          {step === 2 && (
            <>
              <PanelHeader styles={styles} index="02" title="Confirmar conta" subtitle="Confira se esta e a conta correta antes de continuar." />
              <InfoCard styles={styles} rows={[
                { label: "Conta", value: login.trim().toUpperCase() || "-" },
                { label: "Status", value: "Conta localizada", success: true },
                { label: "Plano atual", value: accountOverview?.active ? "Assinatura ativa detectada" : "Sem assinatura ativa" }
              ]} />
              <View style={styles.actionRow}>
                <Button styles={styles} label="Voltar" variant="ghost" onPress={() => setStep(1)} />
                <Button styles={styles} label="Confirmar conta" onPress={onCustomerNext} />
              </View>
            </>
          )}

          {step === 3 && (
            <>
              <PanelHeader styles={styles} index="03" title="Escolha o plano" subtitle="Selecione a opcao ideal para o cliente." />
              {accountOverview?.active ? (
                <View style={styles.dashboardCard}>
                  <View style={styles.dashboardHeader}>
                    <Text style={styles.dashboardTitle}>Plano ativo encontrado</Text>
                    <Text style={styles.dashboardText}>
                      Essa conta ainda possui acesso ativo. Voce pode renovar agora para manter a continuidade sem interrupcao.
                    </Text>
                  </View>

                  <View style={styles.statsGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Plano atual</Text>
                      <Text style={styles.statValue}>{accountOverview.planName}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Tempo restante</Text>
                      <Text style={styles.statValue}>{accountOverview.remainingLabel}</Text>
                    </View>
                    <View style={styles.statCard}>
                      <Text style={styles.statLabel}>Expiracao</Text>
                      <Text style={styles.statValue}>{accountOverview.expiresAt}</Text>
                    </View>
                  </View>
                </View>
              ) : null}
              <View style={styles.planList}>
                {PLANS.map((plan) => (
                  <Pressable
                    key={plan.id}
                    onPress={() => setSelectedPlanId(plan.id)}
                    style={[styles.planCard, selectedPlanId === plan.id && styles.planCardSelected]}
                  >
                    <View>
                      <Text style={styles.planTitle}>{plan.name}</Text>
                      <Text style={styles.planSubtitle}>{plan.subtitle}</Text>
                    </View>
                    <View style={styles.priceChip}>
                      <Text style={styles.priceChipText}>{currency.format(plan.price / 100)}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
              <View style={styles.actionRow}>
                <Button styles={styles} label="Voltar" variant="ghost" onPress={() => setStep(2)} />
                <Button styles={styles} label="Ir para pagamento" onPress={() => setStep(4)} />
              </View>
            </>
          )}

          {step === 4 && (
            <>
              <PanelHeader styles={styles} index="04" title="Pagamento Pix" subtitle="Preencha os dados do pagador e gere a cobranca." />
              <Field styles={styles} label="Nome completo">
                <TextInput
                  value={customer.name}
                  onChangeText={(value) => setCustomer((current) => ({ ...current, name: value }))}
                  placeholder="Nome do pagador"
                  placeholderTextColor="#94a0b1"
                  style={styles.input}
                />
              </Field>
              <Field styles={styles} label="E-mail">
                <TextInput
                  value={customer.email}
                  onChangeText={(value) => setCustomer((current) => ({ ...current, email: value }))}
                  placeholder="cliente@email.com"
                  placeholderTextColor="#94a0b1"
                  autoCapitalize="none"
                  keyboardType="email-address"
                  style={styles.input}
                />
              </Field>
              <Field styles={styles} label="CPF">
                <TextInput
                  value={customer.cpf}
                  onChangeText={(value) => setCustomer((current) => ({ ...current, cpf: value }))}
                  placeholder="000.000.000-00"
                  placeholderTextColor="#94a0b1"
                  keyboardType="numeric"
                  style={styles.input}
                />
              </Field>
              <InfoCard styles={styles} rows={[
                { label: "Plano", value: selectedPlan.name },
                { label: "Conta", value: login.trim().toUpperCase() || "-" },
                { label: "Total", value: currency.format(selectedPlan.price / 100), highlight: true }
              ]} />
              <View style={styles.actionStack}>
                <Button styles={styles} label={loading ? "Processando..." : "Gerar pagamento"} onPress={onGeneratePix} disabled={loading} />
                {payment?.provider_id ? <Button styles={styles} label="Consultar status" variant="ghost" onPress={onStatusCheck} /> : null}
              </View>
              {feedback.message ? (
                <Text style={[
                  styles.feedback,
                  feedback.tone === "error" && styles.feedbackError,
                  feedback.tone === "success" && styles.feedbackSuccess
                ]}>
                  {feedback.message}
                </Text>
              ) : null}

              {payment ? (
                <View style={styles.resultCard}>
                  {paymentQr ? (
                    <View style={styles.qrBox}>
                      <Image source={paymentQr} style={styles.qrImage} resizeMode="contain" />
                    </View>
                  ) : null}

                  <Field styles={styles} label="Codigo Pix copia e cola">
                    <Text selectable style={styles.copyCode}>
                      {payment.copy_paste || "A API nao retornou o copia e cola."}
                    </Text>
                  </Field>

                  <View style={styles.actionRow}>
                    <Button styles={styles} label={Platform.OS === "web" ? "Copiar codigo" : "Compartilhar codigo"} onPress={onSharePixCode} />
                    <Button styles={styles} label="Nova recarga" variant="ghost" onPress={onReset} />
                  </View>
                </View>
              ) : null}
            </>
          )}
        </View>

      </View>
    </View>
  );

  if (!isWide) {
    return checkoutCard;
  }

  return (
    <View style={styles.wideLayout}>
      <View style={styles.marketingCard}>
        <Text style={styles.eyebrow}>Checkout responsivo</Text>
        <Text style={styles.marketingTitle}>App Expo com cara de produto e o mesmo fluxo servindo mobile e web.</Text>
        <Text style={styles.marketingBody}>
          O projeto agora esta pronto para rodar com Expo em Android, iOS e Web, apontando para a API Go por variavel de ambiente.
        </Text>
        <Feature styles={styles} title="Pix imediato" body="Consome o endpoint unificado de pagamentos com provider EFI." />
        <Feature styles={styles} title="Fluxo curto" body="Conta, dados, plano e pagamento em etapas claras." />
        <Feature styles={styles} title="Visual refinado" body="Tema claro e escuro com identidade verde, header e rodape estruturados." />
      </View>
      {checkoutCard}
    </View>
  );
}
