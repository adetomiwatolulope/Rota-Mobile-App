import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, Linking } from "react-native";
import { useRouter } from "expo-router";
import { apiGet, apiPost } from "@/api/client";
import { getAccessToken } from "@/lib/secureStore";
import { PageHead } from "@/components/PageHead";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";
import { useMemo } from "react";

type Plan = {
  code: string;
  name: string;
  monthlyPriceMinor: number;
  includedSeats: number;
  extraSeatPriceMinor: number;
  currency: string;
};

type Subscription = {
  id: string;
  status: string;
  planCode: string | null;
  currentPeriodEnd: string | null;
};

export default function Billing() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const token = await getAccessToken();
      const bizRes = await apiGet<any>("/businesses", token ?? undefined);
      if ("error" in bizRes || !bizRes.data?.businesses?.length) {
        setLoading(false);
        return;
      }
      const bid = bizRes.data.businesses[0].id;
      setBusinessId(bid);
      const [plansRes, subRes] = await Promise.all([
        apiGet<any>(`/businesses/${bid}/billing/plans`, token ?? undefined),
        apiGet<any>(`/businesses/${bid}/subscription`, token ?? undefined),
      ]);
      if (!("error" in plansRes)) setPlans(plansRes.data.plans || []);
      if (!("error" in subRes)) setSubscription(subRes.data.subscription);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleSubscribe = async (planCode: string) => {
    if (!businessId) return;
    const token = await getAccessToken();
    try {
      const res = await apiPost<any>(`/businesses/${businessId}/billing/session`, { planCode }, token ?? undefined, {
        headers: { "Idempotency-Key": `sub-${Date.now()}-${Math.random().toString(36).slice(2)}-${planCode}` },
      });
      if (!("error" in res) && res.data?.url) {
        await Linking.openURL(res.data.url);
      } else if ("error" in res) {
        alert(res.error.message || "Failed to start checkout");
      }
    } catch (e: any) {
      alert(e?.message || "Failed to start checkout");
    }
  };

  const formatPrice = (minor: number) => {
    return `₦${(minor / 100).toLocaleString()}`;
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <PageHead page="Billing" noIndex path="/billing" />
      <Text style={styles.title}>Subscription Plans</Text>
      {subscription?.planCode && (
        <Text style={styles.currentPlan}>Current Plan: {subscription.planCode}</Text>
      )}
      {loading ? (
        <Text style={styles.text}>Loading...</Text>
      ) : (
        plans.map((plan) => (
          <View key={plan.code} style={styles.planCard}>
            <Text style={styles.planName}>{plan.name}</Text>
            <Text style={styles.planPrice}>{formatPrice(plan.monthlyPriceMinor)}/month</Text>
            <Text style={styles.planDetail}>{plan.includedSeats} seats included</Text>
            {plan.extraSeatPriceMinor > 0 && (
              <Text style={styles.planDetail}>Extra seat: {formatPrice(plan.extraSeatPriceMinor)}/month</Text>
            )}
            <Pressable
              accessibilityRole="button"
              style={styles.button}
              onPress={() => handleSubscribe(plan.code)}
            >
              <Text style={styles.buttonLabel}>
                {subscription?.planCode === plan.code ? "Manage" : "Subscribe"}
              </Text>
            </Pressable>
          </View>
        ))
      )}
      <Pressable
        accessibilityRole="button"
        style={styles.secondaryButton}
        onPress={() => router.back()}
      >
        <Text style={styles.secondaryButtonLabel}>Back to Dashboard</Text>
      </Pressable>
    </ScrollView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexGrow: 1,
      alignItems: "center",
      padding: spacing.lg,
      backgroundColor: colors.surface,
      gap: spacing.md,
    },
    title: {
      ...typeStyle("headline-medium"),
      color: colors.onSurface,
      marginTop: spacing.xl,
    },
    currentPlan: {
      ...typeStyle("body-medium"),
      color: colors.primary,
    },
    text: {
      ...typeStyle("body-medium"),
      color: colors.onSurface,
    },
    planCard: {
      width: "100%",
      maxWidth: 400,
      padding: spacing.lg,
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
      gap: spacing.sm,
    },
    planName: {
      ...typeStyle("title-large"),
      color: colors.onSurface,
    },
    planPrice: {
      ...typeStyle("headline-small"),
      color: colors.primary,
    },
    planDetail: {
      ...typeStyle("body-medium"),
      color: colors.onSurfaceVariant,
    },
    button: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      alignItems: "center",
      marginTop: spacing.sm,
    },
    buttonLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
    secondaryButton: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: spacing.md,
    },
    secondaryButtonLabel: {
      ...typeStyle("body-medium"),
      color: colors.primary,
    },
  });
}
