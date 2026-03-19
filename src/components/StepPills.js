import React from "react";
import { Text, View } from "react-native";
import { STEP_LABELS } from "../constants/plans";

export function StepPills({ styles, currentStep }) {
  return (
    <View style={styles.stepsRail}>
      {STEP_LABELS.map((label, index) => {
        const stepNumber = index + 1;
        const active = currentStep === stepNumber;
        const completed = currentStep > stepNumber;
        return (
          <React.Fragment key={label}>
            <View style={styles.stepItem}>
              <View style={[styles.stepCircle, active && styles.stepCircleActive, completed && styles.stepCircleActive]}>
                <Text style={[styles.stepNumber, active && styles.stepNumberActive, completed && styles.stepNumberActive]}>
                  {stepNumber}
                </Text>
              </View>
              <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
            </View>
            {index < STEP_LABELS.length - 1 ? (
              <View style={[styles.stepLine, currentStep > stepNumber && styles.stepLineActive]} />
            ) : null}
          </React.Fragment>
        );
      })}
    </View>
  );
}
