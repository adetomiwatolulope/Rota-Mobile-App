import { useMemo, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { isPasswordValid, passwordPolicyMessage } from "@rota/shared";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { apiPost } from "@/api/client";
import { PageHead } from "@/components/PageHead";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";
import logo from "../assets/logo.png";

// Password reset, FR-003. Two steps on one screen: request a code by email,
// then exchange the code for a new password. The API hides whether the email
// exists, so the request step always advances on a 2xx response.
type Step = "request" | "reset";

const CODE_LENGTH = 6;

const EMAIL_INVALID = "Enter a valid email address";
const CODE_INVALID = "Enter the 6-digit code from your email";
const PASSWORD_INVALID = passwordPolicyMessage();
const PASSWORDS_DO_NOT_MATCH = "Passwords do not match";

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isEmailValid = (value: string): boolean =>
    value.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

  const sendCode = async () => {
    const emailValue = email.trimEnd();
    setEmail(emailValue);
    if (!isEmailValid(emailValue)) {
      Alert.alert("Check your email", EMAIL_INVALID);
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/auth/password/forgot", { email: emailValue });
      if ("error" in res) {
        Alert.alert("Error", res.error.message);
        return;
      }
      setStep("reset");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async () => {
    // Strip trailing spaces before validating and before the data leaves the
    // device, so both passwords are compared as the user meant to type them.
    const codeValue = code.trimEnd();
    const newPasswordValue = newPassword.trimEnd();
    const confirmPasswordValue = confirmPassword.trimEnd();
    setCode(codeValue);
    setNewPassword(newPasswordValue);
    setConfirmPassword(confirmPasswordValue);
    if (!/^\d{6}$/.test(codeValue)) {
      Alert.alert("Check the code", CODE_INVALID);
      return;
    }
    // The password policy is shared with the API and the sign-up checklist. [FR-003]
    if (!isPasswordValid(newPasswordValue)) {
      Alert.alert("Choose a stronger password", PASSWORD_INVALID);
      return;
    }
    if (newPasswordValue !== confirmPasswordValue) {
      Alert.alert("Check the passwords", PASSWORDS_DO_NOT_MATCH);
      return;
    }
    setLoading(true);
    try {
      const res = await apiPost("/auth/password/reset", {
        email: email.trimEnd(),
        code: codeValue,
        newPassword: newPasswordValue,
      });
      if ("error" in res) {
        Alert.alert("Error", res.error.message);
        return;
      }
      Alert.alert("Password updated", "Sign in with your new password.");
      router.replace("/auth");
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageHead page="Reset password" noIndex path="/forgot-password" />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={styles.brand}
          accessibilityRole="link"
          accessibilityLabel="Rota home"
          onPress={() => router.replace("/")}
        >
          <Image source={logo} style={styles.logo} accessibilityLabel="Rota logo" />
          <Text style={styles.wordmark}>Rota</Text>
        </Pressable>
        <View style={styles.headingBlock}>
          <Text style={styles.heading}>Reset your password</Text>
          <Text style={styles.subtitle}>
            {step === "request"
              ? "Enter your account email and we'll send you a reset code."
              : `Enter the code sent to ${email} and choose a new password.`}
          </Text>
        </View>
        <View style={styles.form}>
          {step === "request" ? (
            <>
              <TextInput
                value={email}
                onChangeText={setEmail}
                onBlur={() => setEmail(email.trimEnd())}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Email"
                style={styles.input}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send reset code"
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                style={[styles.primaryButton, loading ? styles.primaryButtonDisabled : null]}
                onPress={() => void sendCode()}
              >
                <Text style={styles.primaryButtonLabel}>
                  {loading ? "Sending..." : "Send reset code"}
                </Text>
              </Pressable>
            </>
          ) : (
            <>
              <TextInput
                value={code}
                onChangeText={setCode}
                onBlur={() => setCode(code.trimEnd())}
                keyboardType="number-pad"
                maxLength={CODE_LENGTH}
                placeholder="6-digit code"
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Reset code"
                style={styles.input}
              />
              <PasswordInput
                value={newPassword}
                onChangeText={setNewPassword}
                onBlur={() => setNewPassword(newPassword.trimEnd())}
                placeholder="New password"
                accessibilityLabel="New password"
              />
              <PasswordRequirements value={newPassword} />
              <PasswordInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                onBlur={() => setConfirmPassword(confirmPassword.trimEnd())}
                placeholder="Confirm new password"
                accessibilityLabel="Confirm new password"
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Reset password"
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                style={[styles.primaryButton, loading ? styles.primaryButtonDisabled : null]}
                onPress={() => void resetPassword()}
              >
                <Text style={styles.primaryButtonLabel}>
                  {loading ? "Resetting..." : "Reset password"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Send a new code"
                style={styles.linkButton}
                onPress={() => setStep("request")}
              >
                <Text style={styles.linkLabel}>Send a new code</Text>
              </Pressable>
            </>
          )}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Return to sign in"
            style={styles.linkButton}
            onPress={() => router.replace("/auth")}
          >
            <Text style={styles.linkLabel}>Return to sign in</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors, insets: EdgeInsets) {
  return StyleSheet.create({
    container: {
      flex: 1,
      paddingHorizontal: spacing.base,
      paddingTop: insets.top + spacing.lg,
      paddingBottom: insets.bottom + spacing.base,
      backgroundColor: colors.surface,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: "center",
      gap: spacing.xl,
      paddingVertical: spacing.lg,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      alignSelf: "center",
    },
    logo: {
      width: 32,
      height: 32,
    },
    wordmark: {
      ...typeStyle("title-large"),
      color: colors.primary,
    },
    headingBlock: {
      alignItems: "center",
      gap: spacing.xs,
    },
    heading: {
      ...typeStyle("headline-medium"),
      color: colors.onSurface,
      textAlign: "center",
    },
    subtitle: {
      ...typeStyle("body-medium"),
      color: colors.onSurfaceVariant,
      textAlign: "center",
    },
    form: {
      gap: spacing.md,
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
    primaryButton: {
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.base,
      borderRadius: radii.pill,
    },
    primaryButtonDisabled: {
      opacity: 0.5,
    },
    primaryButtonLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
    linkButton: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    linkLabel: {
      ...typeStyle("body-medium"),
      color: colors.primary,
    },
  });
}
