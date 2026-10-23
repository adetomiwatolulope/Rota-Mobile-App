import { useEffect, useMemo, useState } from "react";
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
import {
  getDeviceId,
  getPendingInviteToken,
  setTokens,
} from "@/lib/secureStore";
import { useGoogleSignIn } from "@/features/auth/google-sign-in";
import { PageHead } from "@/components/PageHead";
import { PasswordInput } from "@/components/PasswordInput";
import { PasswordRequirements } from "@/components/PasswordRequirements";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";
import logo from "../assets/logo.png";
import googleLogo from "../assets/google.png";

type AuthTokens = {
  accessToken: string;
  refreshToken: string;
};

type LoginResult = AuthTokens | { requiresDeviceVerification: true };

type AuthForm = "sign-in" | "create-account";

type Field = "name" | "email" | "password";

const FIELD_LABELS: Record<Field, string> = {
  name: "Name",
  email: "Email",
  password: "Password",
};

const emptyFieldMessage = (field: Field): string =>
  `${FIELD_LABELS[field]} field cannot be empty`;

const NAME_LETTERS_ONLY = "Name Must Use Only Letters";
const NAME_MIN_TWO_WORDS = "Please enter at least first name and last name";
const NAME_TOO_MANY_WORDS = "Name can have at most 3 words (first, middle, last)";
const EMAIL_INVALID = "Enter A Valid Email Address";
const PASSWORD_INVALID = passwordPolicyMessage();
// Real-time rule: the message shows while the user types and clears the
// moment a domain starts after the "@". The full-format check still runs on
// blur and on submit, because the API rejects addresses without a TLD.
const EMAIL_DOMAIN_STARTED = /^[^\s@]+@[^\s@]/;

// The primary button's label. Always shown: "Submitting..." while in flight,
// then the action name for the current form.
function getPrimaryLabel(loading: boolean, isRegister: boolean): string {
  if (loading) return "Submitting...";
  if (isRegister) return "Create account";
  return "Sign in";
}

/**
 * If this sign-in started from an invite link, return to that invite instead
 * of the dashboard so the person lands in the right team. [FR-007]
 */
async function destinationAfterAuth(): Promise<string> {
  const pendingInvite = await getPendingInviteToken();
  if (pendingInvite) return `/invite/${encodeURIComponent(pendingInvite)}`;
  return "/dashboard";
}

// Single auth page. Both forms live here and render conditionally; the page
// title tracks the form the user is currently viewing.
export default function Auth() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, insets), [colors, insets]);
  const [form, setForm] = useState<AuthForm>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  // A login from a new device returns 202 and emails a code. [FR-002]
  const [deviceVerification, setDeviceVerification] = useState(false);
  const [deviceCode, setDeviceCode] = useState("");
  const [deviceError, setDeviceError] = useState<string | null>(null);

  const validateField = (field: Field, value: string) => {
    setErrors((prev) => {
      if (field === "name") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
          return { ...prev, [field]: emptyFieldMessage(field) };
        }
        const isAlphabets = /^[A-Za-z\s]+$/.test(value);
        if (!isAlphabets) {
          return { ...prev, [field]: NAME_LETTERS_ONLY };
        }
        const words = trimmed.split(/\s+/);
        if (words.length < 2) {
          return { ...prev, [field]: NAME_MIN_TWO_WORDS };
        }
        if (words.length > 3) {
          return { ...prev, [field]: NAME_TOO_MANY_WORDS };
        }
        return { ...prev, [field]: undefined };
      }
      if (value.trim().length === 0) {
        return { ...prev, [field]: emptyFieldMessage(field) };
      }
      if (field === "email") {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return { ...prev, [field]: EMAIL_INVALID };
        }
        return { ...prev, [field]: undefined };
      }
      return { ...prev, [field]: undefined };
    });
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setErrors((prev) => {
      if (value.trim().length === 0) {
        if (prev.email === emptyFieldMessage("email")) return prev;
        return { ...prev, email: emptyFieldMessage("email") };
      }
      if (!EMAIL_DOMAIN_STARTED.test(value)) {
        if (prev.email === EMAIL_INVALID) return prev;
        return { ...prev, email: EMAIL_INVALID };
      }
      if (prev.email !== undefined) {
        return { ...prev, email: undefined };
      }
      return prev;
    });
  };

  // The empty error is raised on blur only; typing real content clears a
  // stale one so a filled field is never stroked red with "cannot be empty".
  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setErrors((prev) =>
      value.trim().length > 0 && prev.password === emptyFieldMessage("password")
        ? { ...prev, password: undefined }
        : prev,
    );
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setErrors((prev) => {
      if (prev.name === undefined) {
        const trimmed = value.trim();
        if (trimmed.length === 0) return prev;
        if (!/^[A-Za-z\s]+$/.test(value)) {
          return { ...prev, name: NAME_LETTERS_ONLY };
        }
        const words = trimmed.split(/\s+/);
        if (words.length < 2 || words.length > 3) {
          return { ...prev, name: words.length < 2 ? NAME_MIN_TWO_WORDS : NAME_TOO_MANY_WORDS };
        }
        return prev;
      }
      const trimmed = value.trim();
      if (trimmed.length === 0) {
        return { ...prev, name: emptyFieldMessage("name") };
      }
      const isAlphabets = /^[A-Za-z\s]+$/.test(value);
      if (!isAlphabets) {
        return { ...prev, name: NAME_LETTERS_ONLY };
      }
      const words = trimmed.split(/\s+/);
      if (words.length < 2) {
        return { ...prev, name: NAME_MIN_TWO_WORDS };
      }
      if (words.length > 3) {
        return { ...prev, name: NAME_TOO_MANY_WORDS };
      }
      return { ...prev, name: undefined };
    });
  };

  const submit = async () => {
    const isRegister = form === "create-account";
    // Strip trailing spaces before validation and before the data leaves the
    // device, so the API always receives what the user meant to enter.
    const nameValue = name.trimEnd();
    const emailValue = email.trimEnd();
    const passwordValue = password.trimEnd();
    setName(nameValue);
    setEmail(emailValue);
    setPassword(passwordValue);
    const values: Record<Field, string> = {
      name: nameValue,
      email: emailValue,
      password: passwordValue,
    };
    const required: Field[] = isRegister
      ? ["name", "email", "password"]
      : ["email", "password"];
    const nextErrors: Partial<Record<Field, string>> = {};
    for (const field of required) {
      if (field === "name" && isRegister) {
        const trimmed = values.name.trim();
        if (trimmed.length === 0) {
          nextErrors.name = emptyFieldMessage("name");
        } else if (!/^[A-Za-z\s]+$/.test(values.name)) {
          nextErrors.name = NAME_LETTERS_ONLY;
        } else {
          const words = trimmed.split(/\s+/);
          if (words.length < 2) {
            nextErrors.name = NAME_MIN_TWO_WORDS;
          } else if (words.length > 3) {
            nextErrors.name = NAME_TOO_MANY_WORDS;
          }
        }
        continue;
      }
      if (field === "email") {
        if (values.email.trim().length === 0) {
          nextErrors.email = emptyFieldMessage("email");
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
          nextErrors.email = EMAIL_INVALID;
        }
        continue;
      }
      if (field === "password") {
        if (values.password.trim().length === 0) {
          nextErrors.password = emptyFieldMessage("password");
        } else if (isRegister && !isPasswordValid(values.password)) {
          nextErrors.password = PASSWORD_INVALID;
        }
        continue;
      }
      if (values[field].trim().length === 0) {
        nextErrors[field] = emptyFieldMessage(field);
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    setLoading(true);
    try {
      const endpoint = isRegister ? "/auth/register" : "/auth/login";
      const deviceId = await getDeviceId();
      const body = isRegister
        ? { email: values.email, password: values.password, name: values.name, deviceId }
        : { email: values.email, password: values.password, deviceId };
      const res = await apiPost<LoginResult>(endpoint, body);
      if ("error" in res) {
        Alert.alert("Error", res.error.message);
        return;
      }
      if ("requiresDeviceVerification" in res.data) {
        setEmail(values.email);
        setDeviceVerification(true);
        setDeviceCode("");
        setDeviceError(null);
        return;
      }
      await setTokens(res.data.accessToken, res.data.refreshToken);
      // Clear credentials so they are never left in the form after success.
      setEmail("");
      setPassword("");
      setName("");
      setErrors({});
      router.replace(await destinationAfterAuth());
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const google = useGoogleSignIn();
  const [googleLoading, setGoogleLoading] = useState(false);

  const completeGoogleSignIn = async (idToken: string) => {
    setGoogleLoading(true);
    try {
      const deviceId = await getDeviceId();
      const res = await apiPost<AuthTokens>("/auth/google", { idToken, deviceId });
      if ("error" in res) {
        Alert.alert("Error", res.error.message);
        return;
      }
      await setTokens(res.data.accessToken, res.data.refreshToken);
      setEmail("");
      setPassword("");
      setName("");
      setErrors({});
      router.replace(await destinationAfterAuth());
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGoogleLoading(false);
    }
  };

  // Google consent completes with an ID token; exchange it for a Rota session.
  useEffect(() => {
    if (!google.idToken || googleLoading) return;
    void completeGoogleSignIn(google.idToken);
  }, [google.idToken]);

  const handleGooglePress = async () => {
    if (!google.isConfigured) {
      Alert.alert(
        "Google sign-in",
        "Google sign-in isn't set up on this device yet. Ask the Rota team to configure it.",
      );
      return;
    }
    if (!google.isReady) {
      Alert.alert("Google sign-in", "Google sign-in is still loading. Try again in a moment.");
      return;
    }
    await google.promptAsync();
  };

  const isRegister = form === "create-account";

  const verifyDevice = async () => {
    if (!/^\d{6}$/.test(deviceCode)) {
      setDeviceError("Enter the 6-digit code from your email");
      return;
    }
    setDeviceError(null);
    setLoading(true);
    try {
      const deviceId = await getDeviceId();
      const res = await apiPost<AuthTokens>("/auth/login/verify-device", {
        email,
        code: deviceCode,
        deviceId,
      });
      if ("error" in res) {
        setDeviceError(res.error.message);
        return;
      }
      await setTokens(res.data.accessToken, res.data.refreshToken);
      setDeviceVerification(false);
      setDeviceCode("");
      router.replace(await destinationAfterAuth());
    } catch (e) {
      setDeviceError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = (): boolean => {
    const values: Record<Field, string> = { name, email, password };
    if (!isRegister) {
      return (
        values.email.trim().length > 0 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email) &&
        values.password.trim().length > 0
      );
    }
    const trimmedName = values.name.trim();
    const nameWords = trimmedName.split(/\s+/);
    const nameValid =
      trimmedName.length > 0 &&
      /^[A-Za-z\s]+$/.test(values.name) &&
      nameWords.length >= 2 &&
      nameWords.length <= 3;
    const emailValid =
      values.email.trim().length > 0 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email);
    const passwordValid =
      values.password.trim().length > 0 &&
      (!isRegister || isPasswordValid(values.password));
    return nameValid && emailValid && passwordValid;
  };

  const canSubmit = !loading && isFormValid();
  const primaryLabel = getPrimaryLabel(loading, isRegister);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageHead
        page={isRegister ? "Create account" : "Sign in"}
        noIndex
        path="/auth"
      />
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
          <Text style={styles.heading}>
            {deviceVerification
              ? "Confirm this device"
              : isRegister
                ? "Create your account"
                : "Welcome back"}
          </Text>
          <Text style={styles.subtitle}>
            {deviceVerification
              ? "Enter the code we emailed you to finish signing in."
              : isRegister
                ? "Fill in your details to get started."
                : "Enter your email and password to continue."}
          </Text>
        </View>
        <View style={styles.form}>
          {deviceVerification ? (
            <>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to {email} to confirm this device.
              </Text>
              <TextInput
                value={deviceCode}
                onChangeText={(value) => {
                  setDeviceCode(value.replace(/\D/g, "").slice(0, 6));
                  if (deviceError) setDeviceError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                placeholder="000000"
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Device verification code"
                style={[styles.input, deviceError ? styles.inputError : null]}
              />
              {deviceError ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {deviceError}
                </Text>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Verify this device"
                accessibilityState={{ disabled: loading }}
                disabled={loading}
                style={[styles.primaryButton, loading ? styles.primaryButtonDisabled : null]}
                onPress={() => void verifyDevice()}
              >
                <Text style={styles.primaryButtonLabel}>
                  {loading ? "Verifying..." : "Verify device"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to sign in"
                style={styles.linkButton}
                onPress={() => {
                  setDeviceVerification(false);
                  setDeviceCode("");
                  setDeviceError(null);
                }}
              >
                <Text style={styles.linkLabel}>Back to sign in</Text>
              </Pressable>
            </>
          ) : (
            <>
              {isRegister && (
                <>
                  <TextInput
                    value={name}
                    onChangeText={handleNameChange}
                    onBlur={() => {
                      const value = name.trimEnd();
                      setName(value);
                      validateField("name", value);
                    }}
                    placeholder={FIELD_LABELS.name}
                    placeholderTextColor={colors.onSurfaceVariant}
                    accessibilityLabel="Name"
                    style={[styles.input, errors.name ? styles.inputError : null]}
                  />
                  {errors.name ? (
                    <Text style={styles.errorText} accessibilityLiveRegion="polite">
                      {errors.name}
                    </Text>
                  ) : null}
                </>
              )}
              <TextInput
                value={email}
                onChangeText={handleEmailChange}
                onBlur={() => {
                  const value = email.trimEnd();
                  setEmail(value);
                  validateField("email", value);
                }}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder={FIELD_LABELS.email}
                placeholderTextColor={colors.onSurfaceVariant}
                accessibilityLabel="Email"
                style={[styles.input, errors.email ? styles.inputError : null]}
              />
              {errors.email ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errors.email}
                </Text>
              ) : null}
              <PasswordInput
                value={password}
                onChangeText={handlePasswordChange}
                onBlur={() => {
                  const value = password.trimEnd();
                  setPassword(value);
                  validateField("password", value);
                }}
                placeholder={FIELD_LABELS.password}
                accessibilityLabel="Password"
                hasError={Boolean(errors.password)}
              />
              <PasswordRequirements value={password} />
              {errors.password ? (
                <Text style={styles.errorText} accessibilityLiveRegion="polite">
                  {errors.password}
                </Text>
              ) : null}
              {!isRegister && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Forgot password"
                  style={styles.forgotButton}
                  onPress={() => router.push("/forgot-password")}
                >
                  <Text style={styles.forgotLabel}>Forgot password?</Text>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isRegister ? "Create account" : "Sign in"}
                accessibilityState={{ disabled: !canSubmit }}
                disabled={!canSubmit}
                style={[styles.primaryButton, !canSubmit ? styles.primaryButtonDisabled : null]}
                onPress={submit}
              >
                <Text style={styles.primaryButtonLabel}>{primaryLabel}</Text>
              </Pressable>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerLabel}>or</Text>
                <View style={styles.dividerLine} />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Sign in with Google"
                accessibilityState={{ disabled: googleLoading }}
                disabled={googleLoading}
                style={[styles.googleButton, googleLoading ? styles.googleButtonDisabled : null]}
                onPress={() => void handleGooglePress()}
              >
                <Image
                  source={googleLogo}
                  style={styles.googleIcon}
                  accessibilityLabel="Google icon"
                />
                <Text style={styles.googleLabel}>
                  {googleLoading ? "Connecting to Google..." : "Sign in with Google"}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={isRegister ? "Sign in to your account" : "Need an account? Create one"}
                style={styles.linkButton}
                onPress={() => {
                  // Clear fields when switching forms so credentials do not carry over.
                  setEmail("");
                  setPassword("");
                  setName("");
                  setErrors({});
                  setForm(isRegister ? "sign-in" : "create-account");
                }}
              >
                <Text style={isRegister ? styles.linkAccent : styles.linkLabel}>
                  {isRegister ? (
                    "Sign in to your account"
                  ) : (
                    <>
                      Need an account?{" "}
                      <Text style={styles.linkAccent}>Create one</Text>
                    </>
                  )}
                </Text>
              </Pressable>
            </>
          )}
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
    // One centred column: brand lockup, heading and form stay grouped and
    // horizontally centred, while the scroll view keeps the form reachable
    // when the keyboard opens on small screens.
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
    inputError: {
      borderColor: colors.error,
    },
    errorText: {
      ...typeStyle("body-small"),
      color: colors.error,
    },
    forgotButton: {
      alignSelf: "flex-end",
      paddingVertical: spacing.xs,
    },
    forgotLabel: {
      ...typeStyle("body-medium"),
      color: colors.primary,
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
    divider: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.outline,
    },
    dividerLabel: {
      ...typeStyle("body-small"),
      color: colors.onSurfaceVariant,
    },
    googleButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingVertical: spacing.base,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surfaceContainer,
    },
    googleIcon: {
      width: 20,
      height: 20,
    },
    googleLabel: {
      ...typeStyle("body-medium"),
      color: colors.onSurface,
    },
    googleButtonDisabled: {
      opacity: 0.5,
    },
    linkButton: {
      alignItems: "center",
      paddingVertical: spacing.sm,
    },
    linkLabel: {
      ...typeStyle("body-medium"),
      color: colors.onSurfaceVariant,
    },
    linkAccent: {
      ...typeStyle("body-medium"),
      color: colors.primary,
    },
  });
}
