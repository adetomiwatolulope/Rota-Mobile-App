import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { Role } from "@rota/shared";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type Props = {
  /** Whether the caller may invite a Manager (Owner only). [FR-006, A-4] */
  canInviteManager: boolean;
  onSubmit: (input: { email: string; role: Role }) => Promise<string | null>;
};

/**
 * FR-006: invite a member by email. Managers may invite Staff only; the Owner
 * may invite Staff or Managers. On success the caller shows the link and code.
 */
export function InviteMemberForm({ canInviteManager, onSubmit }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("STAFF");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim()) {
      setError("Enter an email address");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const message = await onSubmit({ email: email.trim().toLowerCase(), role });
      if (message) {
        setError(message);
        return;
      }
      setEmail("");
      setRole("STAFF");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Invite a member</Text>
      <TextInput
        accessibilityLabel="Invite email"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          if (error) setError(null);
        }}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="name@example.com"
        placeholderTextColor={colors.onSurfaceVariant}
        style={styles.input}
      />

      {canInviteManager ? (
        <View style={styles.roleRow}>
          {(["STAFF", "MANAGER"] as const).map((value) => {
            const selected = value === role;
            return (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value === "STAFF" ? "Invite as Staff" : "Invite as Manager"}
                accessibilityState={{ selected }}
                onPress={() => setRole(value)}
                style={[styles.chip, selected ? styles.chipSelected : null]}
              >
                <Text style={selected ? styles.chipLabelSelected : styles.chipLabel}>
                  {value === "STAFF" ? "Staff" : "Manager"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Send invite"
        disabled={submitting}
        onPress={handleSubmit}
        style={[styles.button, submitting ? styles.buttonDisabled : null]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonLabel}>Send invite</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      width: "100%",
      maxWidth: 420,
      gap: spacing.sm,
      padding: spacing.lg,
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    title: { ...typeStyle("title-medium"), color: colors.onSurface },
    input: {
      ...typeStyle("body-medium"),
      color: colors.onSurface,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    roleRow: { flexDirection: "row", gap: spacing.sm },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
    },
    chipSelected: { borderColor: colors.primary, backgroundColor: colors.surface },
    chipLabel: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    chipLabelSelected: { ...typeStyle("body-small"), color: colors.primary },
    error: { ...typeStyle("body-small"), color: colors.error },
    button: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      marginTop: spacing.xs,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonLabel: { ...typeStyle("body-medium"), color: colors.onPrimary },
  });
}
