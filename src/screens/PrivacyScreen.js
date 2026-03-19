import React from "react";
import { Text, View } from "react-native";
import { PRIVACY_SECTIONS } from "../constants/privacySections";
import { BrandMark } from "../components/BrandMark";
import { Button } from "../components/ui";

export function PrivacyScreen({ styles, isWide, onBack }) {
  return (
    <View style={[styles.privacyContainer, isWide && styles.privacyContainerWide]}>
      <View style={styles.privacyHero}>
        <BrandMark styles={styles} large />
        <View style={styles.privacyHeroText}>
          <Text style={styles.eyebrowAccent}>PulsePay</Text>
          <Text style={styles.privacyTitle}>Politica de Privacidade</Text>
          <Text style={styles.privacyLead}>
            Base inicial de tratamento de dados do app e do checkout web, pronta para evoluir com o juridico depois.
          </Text>
        </View>
      </View>

      <View style={styles.privacyCard}>
        {PRIVACY_SECTIONS.map((section) => (
          <View key={section.title} style={styles.privacySection}>
            <Text style={styles.privacySectionTitle}>{section.title}</Text>
            <Text style={styles.privacySectionBody}>{section.body}</Text>
          </View>
        ))}

        <View style={styles.privacyActions}>
          <Button styles={styles} label="Voltar ao checkout" onPress={onBack} />
        </View>
      </View>
    </View>
  );
}
