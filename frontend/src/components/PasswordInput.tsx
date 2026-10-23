import { useMemo, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type PasswordInputProps = {
  value: string;
  onChangeText: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  accessibilityLabel: string;
  hasError?: boolean;
};

// Password field with a visibility toggle. The toggle only appears once the
// user has typed something, so an empty field looks identical to the others.
export function PasswordInput({
  value,
  onChangeText,
  onBlur,
  placeholder,
  accessibilityLabel,
  hasError = false,
}: PasswordInputProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isVisible, setIsVisible] = useState(false);

  return (
    <View style={styles.field}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        secureTextEntry={!isVisible}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceVariant}
        accessibilityLabel={accessibilityLabel}
        style={[styles.input, styles.inputWithToggle, hasError ? styles.inputError : null]}
      />
      {value.length > 0 ? (
        <Ionicons
          name={isVisible ? "eye-off-outline" : "eye-outline"}
          size={20}
          color={colors.onSurfaceVariant}
          accessibilityRole="button"
          accessibilityLabel={isVisible ? "Hide password" : "Show password"}
          onPress={() => setIsVisible((prev) => !prev)}
          style={styles.toggle}
          suppressHighlighting
        />
      ) : null}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    field: {
      position: "relative",
      justifyContent: "center",
    },
    input: {
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: 12,
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
      ...typeStyle("body-large"),
      color: colors.onSurface,
    },
    inputWithToggle: {
      paddingRight: spacing.xxl,
    },
    inputError: {
      borderColor: colors.error,
    },
    // Absolutely positioned inside the field so the input box keeps the exact
    // same size as every other field.
    toggle: {
      position: "absolute",
      right: spacing.sm,
      padding: spacing.xs,
    },
  });
}
