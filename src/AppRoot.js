import React, { useMemo, useState } from "react";
import { Alert, Linking, Platform, Pressable, SafeAreaView, ScrollView, Share, Text, useColorScheme, useWindowDimensions, View } from "react-native";
import { PLANS } from "./constants/plans";
import { createPixPayment, fetchPixStatus, normalizeCpf, qrSource } from "./lib/paymentApi";
import { createAppStyles, getTheme } from "./styles/appStyles";
import { CheckoutScreen } from "./screens/CheckoutScreen";
import { PrivacyScreen } from "./screens/PrivacyScreen";
import { BrandMark } from "./components/BrandMark";

const DEMO_ALWAYS_PASS_LOGIN = "PULSEVIP";

function getAccountOverview(loginValue) {
  const normalized = loginValue.trim().toUpperCase();

  if (normalized === DEMO_ALWAYS_PASS_LOGIN || normalized.startsWith("ATIVO")) {
    return {
      active: true,
      planId: "annual",
      planName: "Anual Premium",
      remainingLabel: "128 dias",
      expiresAt: "24/07/2026",
      lastPayment: "16/03/2026",
      currentPrice: "R$ 250,00",
      customer: {
        name: "Cliente Demo",
        email: "cliente.demo@recargafacil.com",
        cpf: "12345678901"
      }
    };
  }

  return { active: false };
}

function AppRoot() {
  const { width } = useWindowDimensions();
  const systemTheme = useColorScheme();
  const isWide = width >= 960;
  const isCompact = width < 430;
  const [themeMode, setThemeMode] = useState(systemTheme === "dark" ? "dark" : "light");
  const [screen, setScreen] = useState("checkout");
  const [step, setStep] = useState(1);
  const [login, setLogin] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", cpf: "" });
  const [selectedPlanId, setSelectedPlanId] = useState("semiannual");
  const [accountOverview, setAccountOverview] = useState(null);
  const [payment, setPayment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", tone: "neutral" });

  const selectedPlan = useMemo(
    () => PLANS.find((plan) => plan.id === selectedPlanId) || PLANS[0],
    [selectedPlanId]
  );

  const paymentQr = useMemo(() => qrSource(payment?.qr_code || ""), [payment]);
  const theme = useMemo(() => getTheme(themeMode), [themeMode]);
  const styles = useMemo(() => createAppStyles(theme, isCompact), [theme, isCompact]);

  function showError(message) {
    setFeedback({ message, tone: "error" });
  }

  function showSuccess(message) {
    setFeedback({ message, tone: "success" });
  }

  function showInfo(message) {
    setFeedback({ message, tone: "neutral" });
  }

  function handleNextFromLogin() {
    if (!login.trim()) {
      Alert.alert("Login obrigatorio", "Informe o login da conta para continuar.");
      return;
    }

    const overview = getAccountOverview(login);
    setAccountOverview(overview);

    if (overview.active) {
      setSelectedPlanId(overview.planId || "annual");
      if (overview.customer) {
        setCustomer(overview.customer);
      }
    }

    setStep(2);
  }

  function handleConfirmAccount() {
    setStep(3);
  }

  async function handleGeneratePix() {
    if (!customer.name.trim() || !customer.email.trim() || normalizeCpf(customer.cpf).length !== 11) {
      Alert.alert("Dados incompletos", "Preencha nome, e-mail e um CPF valido.");
      return;
    }

    setLoading(true);
    setPayment(null);
    showInfo("Gerando pagamento Pix...");

    try {
      const data = await createPixPayment({
        login: login.trim().toUpperCase(),
        customer,
        planId: selectedPlanId
      });
      setPayment(data);
      showSuccess("Pix gerado com sucesso. O cliente ja pode pagar.");
      setStep(4);
    } catch (error) {
      showError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusCheck() {
    if (!payment?.provider_id) {
      return;
    }

    showInfo("Consultando status...");
    try {
      const data = await fetchPixStatus(payment.provider_id);
      const status = String(data.status || "desconhecido").toUpperCase();
      const paid = status.includes("PAID") || status.includes("APPROVED") || status.includes("CONCLUIDA");
      if (paid) {
        showSuccess(`Pagamento confirmado com status ${status}.`);
      } else {
        showInfo(`Status atual: ${status}.`);
      }
    } catch (error) {
      showError(error.message);
    }
  }

  async function handleSharePixCode() {
    if (!payment?.copy_paste) {
      return;
    }

    if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(payment.copy_paste);
      showSuccess("Codigo Pix copiado.");
      return;
    }

    await Share.share({ message: payment.copy_paste });
  }

  function resetFlow() {
    setStep(1);
    setAccountOverview(null);
    setPayment(null);
    setFeedback({ message: "", tone: "neutral" });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.appShell}>
          <View style={styles.header}>
            <View style={styles.headerRow}>
              <View style={styles.headerBrand}>
                <BrandMark styles={styles} />
                <View>
                  <Text style={styles.brandTitle}>Recarga Facil</Text>
                  <Text style={styles.brandSubtitle}>Renovacao de planos com Pix</Text>
                </View>
              </View>

              <Pressable
                onPress={() => setThemeMode((current) => (current === "dark" ? "light" : "dark"))}
                style={[styles.themeOption, styles.themeOptionActive]}
              >
                <Text style={[styles.themeOptionText, styles.themeIcon, styles.themeOptionTextActive]}>
                  {themeMode === "dark" ? "☾" : "◌"}
                </Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.pageBody}>
            {screen === "privacy" ? (
              <PrivacyScreen styles={styles} isWide={isWide} onBack={() => setScreen("checkout")} />
            ) : (
              <CheckoutScreen
                styles={styles}
                isWide={isWide}
                step={step}
                login={login}
                setLogin={setLogin}
                customer={customer}
                setCustomer={setCustomer}
                selectedPlan={selectedPlan}
                selectedPlanId={selectedPlanId}
                setSelectedPlanId={setSelectedPlanId}
                accountOverview={accountOverview}
                payment={payment}
                paymentQr={paymentQr}
                loading={loading}
                feedback={feedback}
                onPrivacy={() => setScreen("privacy")}
                onLoginNext={handleNextFromLogin}
                onCustomerNext={handleConfirmAccount}
                onGeneratePix={handleGeneratePix}
                onStatusCheck={handleStatusCheck}
                onSharePixCode={handleSharePixCode}
                onReset={resetFlow}
                setStep={setStep}
              />
            )}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerContent}>
              <Text style={styles.footerText}>
                <Text style={styles.footerTextStrong}>Recarga Facil</Text> {"\n"}Plataforma de recarga e renovacao de planos com Pix, pensada para uma experiencia simples, clara e confiavel.
              </Text>
              <View style={styles.footerLinks}>
                <Pressable onPress={() => Linking.openURL("mailto:suporte@recargafacil.com").catch(() => {})}>
                  <Text style={styles.footerLink}>suporte@recargafacil.com</Text>
                </Pressable>
                <Pressable onPress={() => Linking.openURL("tel:+550800000000").catch(() => {})}>
                  <Text style={styles.footerLink}>0800 000 0000</Text>
                </Pressable>
                <Pressable onPress={() => setScreen("privacy")}>
                  <Text style={styles.footerLink}>Politica e privacidade</Text>
                </Pressable>
              </View>
              <Text style={styles.footerMeta}>Atendimento de segunda a sexta, das 8h as 18h.</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default AppRoot;
