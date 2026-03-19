import { StyleSheet } from "react-native";

const lightTheme = {
  background: "#f3f7f3",
  surface: "#ffffff",
  surfaceSoft: "#f7faf7",
  surfaceMuted: "#eef3ef",
  border: "#d9e5dd",
  borderStrong: "#c6d8cb",
  text: "#1c2430",
  textMuted: "#6b7689",
  textSoft: "#8b95a5",
  primary: "#1f9d7a",
  primaryStrong: "#167d61",
  primarySoft: "#dff5ee",
  success: "#0f9f6e",
  danger: "#cb4b65",
  shadow: "rgba(17, 38, 28, 0.10)",
  footer: "#f8fbf8"
};

const darkTheme = {
  background: "#08110d",
  surface: "#101b17",
  surfaceSoft: "#13221c",
  surfaceMuted: "#162821",
  border: "#20342c",
  borderStrong: "#295041",
  text: "#edf6f0",
  textMuted: "#9eb0a7",
  textSoft: "#7f9188",
  primary: "#33c28f",
  primaryStrong: "#21a776",
  primarySoft: "#11382c",
  success: "#47d79f",
  danger: "#ff7b93",
  shadow: "rgba(0, 0, 0, 0.30)",
  footer: "#0d1713"
};

export function getTheme(mode) {
  return mode === "dark" ? darkTheme : lightTheme;
}

export function createAppStyles(theme, compact = false) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background
    },
    scrollContent: {
      flexGrow: 1,
      backgroundColor: theme.background
    },
    appShell: {
      flexGrow: 1
    },
    header: {
      paddingHorizontal: compact ? 14 : 22,
      paddingTop: compact ? 10 : 18,
      paddingBottom: compact ? 10 : 18,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.surface
    },
    headerRow: {
      width: "100%",
      maxWidth: 1180,
      alignSelf: "center",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between"
    },
    headerBrand: {
      flexDirection: "row",
      alignItems: "center",
      gap: compact ? 10 : 14,
      flexShrink: 1
    },
    brandMark: {
      width: compact ? 42 : 58,
      height: compact ? 42 : 58
    },
    brandMarkLarge: {
      width: 60,
      height: 60
    },
    brandOuter: {
      flex: 1,
      borderRadius: compact ? 16 : 20,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 }
    },
    brandInner: {
      width: "82%",
      height: "82%",
      borderRadius: compact ? 12 : 16,
      backgroundColor: theme.primaryStrong,
      alignItems: "center",
      justifyContent: "center"
    },
    brandLetter: {
      color: "#ffffff",
      fontSize: compact ? 22 : 28,
      fontWeight: "900"
    },
    brandLetterLarge: {
      fontSize: 30
    },
    brandTitle: {
      color: theme.text,
      fontSize: compact ? 15 : 22,
      fontWeight: "800"
    },
    brandSubtitle: {
      color: theme.textMuted,
      fontSize: compact ? 10 : 13,
      marginTop: 2
    },
    themeOption: {
      width: compact ? 40 : 50,
      height: compact ? 40 : 50,
      borderRadius: compact ? 14 : 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.borderStrong
    },
    themeOptionActive: {
      backgroundColor: theme.surface,
      shadowColor: theme.shadow,
      shadowOpacity: 1,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 }
    },
    themeOptionText: {
      color: theme.textMuted,
      fontWeight: "700"
    },
    themeOptionTextActive: {
      color: theme.text
    },
    themeIcon: {
      fontSize: compact ? 18 : 20,
      lineHeight: compact ? 20 : 22
    },
    pageBody: {
      width: "100%",
      maxWidth: 1180,
      alignSelf: "center",
      paddingHorizontal: compact ? 12 : 22,
      paddingTop: compact ? 12 : 26,
      paddingBottom: compact ? 12 : 28
    },
    wideLayout: {
      flexDirection: "row",
      gap: 24,
      alignItems: "flex-start"
    },
    marketingCard: {
      flex: 1.02,
      borderRadius: 32,
      padding: 30,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border
    },
    eyebrow: {
      color: theme.primaryStrong,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 8
    },
    eyebrowAccent: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 1.2,
      marginBottom: 8
    },
    marketingTitle: {
      color: theme.text,
      fontSize: 46,
      lineHeight: 46,
      fontWeight: "900",
      marginBottom: 16,
      maxWidth: 520
    },
    marketingBody: {
      color: theme.textMuted,
      fontSize: 16,
      lineHeight: 27,
      marginBottom: 20,
      maxWidth: 560
    },
    checkoutCard: {
      width: "100%",
      maxWidth: 480,
      alignSelf: "center",
      borderRadius: compact ? 22 : 34,
      overflow: "hidden",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border
    },
    checkoutCardWide: {
      flex: 0.88,
      maxWidth: 470
    },
    checkoutInner: {
      paddingHorizontal: compact ? 12 : 22,
      paddingVertical: compact ? 14 : 24
    },
    heroRow: {
      alignItems: "center",
      marginBottom: compact ? 8 : 16
    },
    heroTitle: {
      color: theme.text,
      fontSize: compact ? 23 : 42,
      lineHeight: compact ? 27 : 46,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 8
    },
    heroCopy: {
      color: theme.textMuted,
      fontSize: compact ? 12 : 16,
      lineHeight: compact ? 18 : 26,
      textAlign: "center"
    },
    stepsRail: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      marginBottom: compact ? 14 : 28
    },
    stepItem: {
      flex: 1,
      alignItems: "center"
    },
    stepLine: {
      flex: 1,
      height: 2,
      backgroundColor: theme.border,
      marginHorizontal: compact ? 6 : 10,
      marginTop: compact ? 16 : 18
    },
    stepLineActive: {
      backgroundColor: theme.primary
    },
    stepCircle: {
      width: compact ? 32 : 42,
      height: compact ? 32 : 42,
      borderRadius: compact ? 16 : 21,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surfaceMuted,
      borderWidth: 1,
      borderColor: theme.border
    },
    stepCircleActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary
    },
    stepNumber: {
      color: theme.textMuted,
      fontSize: compact ? 12 : 16,
      fontWeight: "800"
    },
    stepNumberActive: {
      color: "#ffffff"
    },
    stepLabel: {
      color: theme.textMuted,
      fontSize: compact ? 10 : 12,
      fontWeight: "700",
      marginTop: 6,
      textAlign: "center"
    },
    stepLabelActive: {
      color: theme.primaryStrong
    },
    panel: {
      borderRadius: compact ? 20 : 28,
      padding: compact ? 14 : 24,
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border
    },
    panelHeader: {
      alignItems: "center",
      marginBottom: compact ? 14 : 24
    },
    panelIndex: {
      width: compact ? 30 : 38,
      height: compact ? 30 : 38,
      borderRadius: compact ? 15 : 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
      marginBottom: 10
    },
    panelIndexText: {
      color: theme.primaryStrong,
      fontWeight: "900"
    },
    panelTitle: {
      color: theme.text,
      fontSize: compact ? 18 : 28,
      fontWeight: "900",
      textAlign: "center",
      marginBottom: 8
    },
    panelSubtitle: {
      color: theme.textMuted,
      lineHeight: compact ? 19 : 24,
      textAlign: "center"
    },
    field: {
      marginBottom: compact ? 12 : 16
    },
    fieldLabel: {
      color: theme.text,
      fontSize: compact ? 13 : 15,
      fontWeight: "800",
      marginBottom: 10
    },
    input: {
      borderRadius: compact ? 16 : 20,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.surface,
      color: theme.text,
      paddingHorizontal: 14,
      paddingVertical: compact ? 12 : 17,
      fontSize: compact ? 15 : 17
    },
    button: {
      minHeight: compact ? 48 : 58,
      borderRadius: compact ? 16 : 22,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18
    },
    buttonPrimary: {
      backgroundColor: theme.primary
    },
    buttonGhost: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.borderStrong
    },
    buttonDisabled: {
      opacity: 0.55
    },
    buttonText: {
      color: "#ffffff",
      fontWeight: "800",
      fontSize: compact ? 15 : 17
    },
    buttonTextGhost: {
      color: theme.text
    },
    actionRow: {
      flexDirection: "row",
      gap: 10
    },
    actionStack: {
      gap: 12
    },
    infoCard: {
      borderRadius: compact ? 16 : 20,
      padding: compact ? 12 : 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16
    },
    infoRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 12,
      paddingVertical: compact ? 9 : 12
    },
    infoRowHighlight: {
      borderRadius: 16,
      backgroundColor: theme.primarySoft,
      paddingHorizontal: 12
    },
    infoLabel: {
      color: theme.textMuted
    },
    infoValue: {
      color: theme.text,
      fontWeight: "800",
      textAlign: "right"
    },
    infoValueSuccess: {
      color: theme.success
    },
    infoValueHighlight: {
      color: theme.primaryStrong
    },
    dashboardCard: {
      borderRadius: compact ? 16 : 22,
      padding: compact ? 12 : 20,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16
    },
    dashboardHeader: {
      marginBottom: 12
    },
    dashboardTitle: {
      color: theme.text,
      fontSize: compact ? 17 : 24,
      fontWeight: "900",
      marginBottom: 6
    },
    dashboardText: {
      color: theme.textMuted,
      lineHeight: compact ? 19 : 22
    },
    statsGrid: {
      gap: 8,
      marginTop: 10,
      marginBottom: 12
    },
    statCard: {
      borderRadius: 14,
      padding: compact ? 12 : 16,
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border
    },
    statLabel: {
      color: theme.textSoft,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      marginBottom: 4
    },
    statValue: {
      color: theme.text,
      fontSize: compact ? 16 : 20,
      fontWeight: "900"
    },
    planList: {
      gap: 10
    },
    planCard: {
      borderRadius: compact ? 16 : 20,
      padding: compact ? 12 : 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center"
    },
    planCardSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.primarySoft
    },
    planTitle: {
      color: theme.text,
      fontSize: compact ? 15 : 20,
      fontWeight: "800"
    },
    planSubtitle: {
      color: theme.textMuted,
      marginTop: 2
    },
    priceChip: {
      borderRadius: 999,
      backgroundColor: theme.primary,
      paddingHorizontal: compact ? 10 : 14,
      paddingVertical: compact ? 7 : 10
    },
    priceChipText: {
      color: "#ffffff",
      fontWeight: "800"
    },
    feedback: {
      marginTop: 10,
      marginBottom: 10,
      fontWeight: "700",
      color: theme.textMuted
    },
    feedbackError: {
      color: theme.danger
    },
    feedbackSuccess: {
      color: theme.success
    },
    resultCard: {
      marginTop: 8,
      borderRadius: compact ? 16 : 20,
      padding: compact ? 12 : 18,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      gap: 14
    },
    qrBox: {
      backgroundColor: "#ffffff",
      borderRadius: 16,
      padding: 12
    },
    qrImage: {
      width: "100%",
      height: compact ? 190 : 260
    },
    copyCode: {
      color: theme.text,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.borderStrong,
      backgroundColor: theme.surfaceSoft,
      paddingHorizontal: 14,
      paddingVertical: 12
    },
    featureCard: {
      borderRadius: 22,
      padding: 18,
      backgroundColor: theme.surfaceSoft,
      borderWidth: 1,
      borderColor: theme.border,
      marginTop: 12
    },
    featureTitle: {
      color: theme.text,
      fontWeight: "800",
      marginBottom: 6,
      fontSize: 16
    },
    featureBody: {
      color: theme.textMuted,
      lineHeight: 24
    },
    demoHint: {
      marginTop: 10,
      color: theme.primaryStrong,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center"
    },
    privacyContainer: {
      width: "100%",
      maxWidth: 980,
      alignSelf: "center"
    },
    privacyContainerWide: {
      marginTop: 6
    },
    privacyHero: {
      borderRadius: 26,
      padding: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      gap: 16,
      alignItems: "center",
      marginBottom: 16
    },
    privacyHeroText: {
      flex: 1
    },
    privacyTitle: {
      color: theme.text,
      fontSize: compact ? 26 : 38,
      fontWeight: "900",
      marginBottom: 8
    },
    privacyLead: {
      color: theme.textMuted,
      lineHeight: 24
    },
    privacyCard: {
      borderRadius: 26,
      padding: 22,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border
    },
    privacySection: {
      paddingBottom: 16,
      marginBottom: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border
    },
    privacySectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 8
    },
    privacySectionBody: {
      color: theme.textMuted,
      lineHeight: 22
    },
    privacyActions: {
      marginTop: 8
    },
    footer: {
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.footer,
      paddingHorizontal: compact ? 14 : 22,
      paddingVertical: compact ? 12 : 18
    },
    footerContent: {
      width: "100%",
      maxWidth: 1180,
      alignSelf: "center",
      gap: compact ? 8 : 12
    },
    footerText: {
      color: theme.textMuted,
      fontSize: compact ? 11 : 13,
      lineHeight: compact ? 17 : 20
    },
    footerTextStrong: {
      color: theme.text,
      fontWeight: "800"
    },
    footerLinks: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: compact ? 8 : 10
    },
    footerLink: {
      color: theme.primaryStrong,
      fontSize: compact ? 11 : 13,
      fontWeight: "700"
    },
    footerMeta: {
      color: theme.textSoft,
      fontSize: compact ? 10 : 12
    }
  });
}
