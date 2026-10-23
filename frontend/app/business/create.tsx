import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { BUSINESS_TYPES, type BusinessTypeValue } from "@rota/shared";
import { createBusiness } from "@/api/team";
import { PageHead } from "@/components/PageHead";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

const TYPE_LABELS: Record<BusinessTypeValue, string> = {
  RESTAURANT: "Restaurant",
  CLINIC: "Clinic",
  RETAIL: "Retail",
  OTHER: "Other",
};

/**
 * FR-004: create a business workspace. The creator becomes the Owner and a
 * TRIALING subscription row is created. Currency is NGN and cannot be changed.
 */
export default function CreateBusiness() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [name, setName] = useState("");
  const [type, setType] = useState<BusinessTypeValue>("RESTAURANT");
  const [locationName, setLocationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("Enter a business name");
      return;
    }
    if (!locationName.trim()) {
      setError("Enter a location name");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await createBusiness({
        name: name.trim(),
        type,
        locationName: locationName.trim(),
        timezone: "Africa/Lagos",
        countryCode: "NG",
      });
      if ("error" in res) {
        setError(res.error.message);
        return;
      }
      router.replace("/team");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <PageHead page="Create business" noIndex path="/business/create" />
      <View style={styles.headerRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
          style={styles.backIcon}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Create a business</Text>
        <View style={styles.headerSpacer} />
      </View>
      <Text style={styles.subtitle}>You will be the Owner of this business.</Text>

      <TextInput
        accessibilityLabel="Business name"
        value={name}
        onChangeText={(t) => {
          setName(t);
          if (error) setError(null);
        }}
        placeholder="Business name"
        placeholderTextColor={colors.onSurfaceVariant}
        style={styles.input}
      />

      <Text style={styles.label}>Type</Text>
      <View style={styles.typeRow}>
        {BUSINESS_TYPES.map((value) => {
          const selected = value === type;
          return (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityLabel={TYPE_LABELS[value]}
              accessibilityState={{ selected }}
              onPress={() => setType(value)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text style={selected ? styles.chipLabelSelected : styles.chipLabel}>
                {TYPE_LABELS[value]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <TextInput
        accessibilityLabel="Location name"
        value={locationName}
        onChangeText={(t) => {
          setLocationName(t);
          if (error) setError(null);
        }}
        placeholder="Location name (e.g. Main branch)"
        placeholderTextColor={colors.onSurfaceVariant}
        style={styles.input}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Create business"
        disabled={submitting}
        onPress={handleSubmit}
        style={[styles.button, submitting ? styles.buttonDisabled : null]}
      >
        {submitting ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={styles.buttonLabel}>Create business</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      gap: spacing.md,
      padding: spacing.lg,
      paddingTop: spacing.xxxl,
      backgroundColor: colors.surface,
    },
    headerRow: {
      width: "100%",
      maxWidth: 420,
      flexDirection: "row",
      alignItems: "center",
    },
    backIcon: { padding: spacing.xs },
    headerSpacer: { width: 32 },
    title: { ...typeStyle("headline-medium"), color: colors.onSurface, flex: 1, textAlign: "center" },
    subtitle: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant },
    label: { ...typeStyle("label-medium"), color: colors.onSurfaceVariant, alignSelf: "flex-start", maxWidth: 420 },
    input: {
      ...typeStyle("body-medium"),
      width: "100%",
      maxWidth: 420,
      color: colors.onSurface,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radii.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
    },
    typeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.sm,
      width: "100%",
      maxWidth: 420,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
    },
    chipSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.surfaceContainer,
    },
    chipLabel: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    chipLabelSelected: { ...typeStyle("body-small"), color: colors.primary },
    error: { ...typeStyle("body-small"), color: colors.error, maxWidth: 420 },
    button: {
      alignItems: "center",
      justifyContent: "center",
      width: "100%",
      maxWidth: 420,
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      marginTop: spacing.xs,
    },
    buttonDisabled: { opacity: 0.6 },
    buttonLabel: { ...typeStyle("body-medium"), color: colors.onPrimary },
  });
}
