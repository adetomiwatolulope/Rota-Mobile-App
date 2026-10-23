import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

// Minimal contact form shared by the contact page. Visual only — there is no
// contact endpoint in the PRD, so Send does nothing yet. Entered text is
// trimmed of trailing spaces on blur so the stored value is clean.
export function ContactForm() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  return (
    <View style={styles.form}>
      <TextInput
        value={name}
        onChangeText={setName}
        onBlur={() => setName(name.trimEnd())}
        style={styles.input}
        placeholder="Name"
        placeholderTextColor={colors.onSurfaceVariant}
        accessibilityLabel="Name"
      />
      <TextInput
        value={email}
        onChangeText={setEmail}
        onBlur={() => setEmail(email.trimEnd())}
        style={styles.input}
        placeholder="Email"
        placeholderTextColor={colors.onSurfaceVariant}
        keyboardType="email-address"
        autoCapitalize="none"
        accessibilityLabel="Email"
      />
      <TextInput
        value={message}
        onChangeText={setMessage}
        onBlur={() => setMessage(message.trimEnd())}
        style={[styles.input, styles.message]}
        placeholder="Message"
        placeholderTextColor={colors.onSurfaceVariant}
        multiline
        accessibilityLabel="Message"
      />
      <Pressable
        style={styles.button}
        accessibilityRole="button"
        accessibilityLabel="Send message"
      >
        <Text style={styles.buttonLabel}>Send</Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    form: {
      width: "100%",
      maxWidth: 420,
      gap: spacing.base,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: spacing.base,
      paddingVertical: spacing.md,
      ...typeStyle("body-large"),
      color: colors.onSurface,
    },
    message: {
      minHeight: 120,
      textAlignVertical: "top",
    },
    button: {
      alignSelf: "flex-start",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.xl,
      borderRadius: radii.pill,
    },
    buttonLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
  });
}
