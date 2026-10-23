import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { visiblePasswordRules } from "@rota/shared";
import { spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type PasswordRequirementsProps = {
  value: string;
};

// Real-time password hint. Hidden while the field is empty; once the user starts
// typing it shows a single rule at a time and advances as each is satisfied. The
// rule is checked green when met. Rules come from @rota/shared, the same source
// the API validates against.
export function PasswordRequirements({ value }: PasswordRequirementsProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const rule = value.length > 0 ? visiblePasswordRules(value)[0] : undefined;

  if (!rule) {
    return null;
  }

  const met = rule.test(value);

  return (
    <View style={styles.row} accessibilityLabel="Password requirement">
      <Ionicons
        name={met ? "checkmark-circle" : "ellipse-outline"}
        size={16}
        color={met ? colors.success : colors.onSurfaceVariant}
      />
      <Text style={[styles.label, met ? styles.labelMet : null]}>
        {rule.label}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingTop: spacing.xs,
    },
    label: {
      ...typeStyle("body-small"),
      flex: 1,
      color: colors.onSurfaceVariant,
    },
    labelMet: {
      color: colors.onSurface,
    },
  });
}

