import React from "react";
import { Pressable, Text, View } from "react-native";

export function PanelHeader({ styles, index, title, subtitle }) {
  return (
    <View style={styles.panelHeader}>
      <View style={styles.panelIndex}>
        <Text style={styles.panelIndexText}>{index}</Text>
      </View>
      <View style={styles.panelHeaderText}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelSubtitle}>{subtitle}</Text>
      </View>
    </View>
  );
}

export function Field({ styles, label, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Button({ styles, label, onPress, variant = "primary", disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        variant === "ghost" ? styles.buttonGhost : styles.buttonPrimary,
        disabled && styles.buttonDisabled
      ]}
    >
      <Text style={[styles.buttonText, variant === "ghost" && styles.buttonTextGhost]}>{label}</Text>
    </Pressable>
  );
}

export function InfoCard({ styles, rows }) {
  return (
    <View style={styles.infoCard}>
      {rows.map((row) => (
        <View key={row.label} style={[styles.infoRow, row.highlight && styles.infoRowHighlight]}>
          <Text style={styles.infoLabel}>{row.label}</Text>
          <Text style={[styles.infoValue, row.success && styles.infoValueSuccess, row.highlight && styles.infoValueHighlight]}>
            {row.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function Feature({ styles, title, body }) {
  return (
    <View style={styles.featureCard}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}
