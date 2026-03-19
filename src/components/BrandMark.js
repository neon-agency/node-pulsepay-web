import React from "react";
import { Text, View } from "react-native";

export function BrandMark({ styles, large = false }) {
  return (
    <View style={[styles.brandMark, large && styles.brandMarkLarge]}>
      <View style={styles.brandOuter}>
        <View style={styles.brandInner}>
          <Text style={[styles.brandLetter, large && styles.brandLetterLarge]}>P</Text>
        </View>
      </View>
    </View>
  );
}
