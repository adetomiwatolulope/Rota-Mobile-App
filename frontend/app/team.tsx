import { useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { BusinessSummary, InviteSummary, MemberSummary, Role } from "@rota/shared";
import {
  changeMemberRole,
  inviteMember,
  listBusinesses,
  listInvites,
  listMembers,
  removeMember,
  resendInvite,
  revokeInvite,
} from "@/api/team";
import { queryKeys } from "@/api/queryKeys";
import { endSession } from "@/api/session";
import { unregisterPushNotifications } from "@/features/notifications/push";
import { QUERY_CACHE } from "@/lib/queryClient";
import { PageHead } from "@/components/PageHead";
import { InviteMemberForm } from "@/components/InviteMemberForm";
import { Ionicons } from "@expo/vector-icons";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type MembersResult = Awaited<ReturnType<typeof listMembers>>;

/**
 * Team screen. All server data (businesses, members, invites) is fetched and
 * cached by TanStack Query; the cache is persisted for offline reading. The
 * role change is an optimistic "settings change" with rollback, matching the
 * pattern the swap request will use once swaps exist.
 */
export default function Team() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string }>();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const businessesQuery = useQuery({
    queryKey: queryKeys.businesses,
    queryFn: listBusinesses,
    staleTime: QUERY_CACHE.staleTime,
  });

  const requestedBusinessId =
    typeof params.businessId === "string" ? params.businessId : "";
  const business: BusinessSummary | null =
    businessesQuery.data && !("error" in businessesQuery.data)
      ? (businessesQuery.data.data.businesses.find(
          (item) => item.id === requestedBusinessId,
        ) ??
          businessesQuery.data.data.businesses[0] ??
          null)
      : null;
  const businessId = business?.id ?? "";

  const membersQuery = useQuery({
    queryKey: queryKeys.members(businessId),
    queryFn: () => listMembers(businessId),
    enabled: businessId.length > 0,
    staleTime: QUERY_CACHE.staleTime,
  });

  const invitesQuery = useQuery({
    queryKey: queryKeys.invites(businessId),
    queryFn: () => listInvites(businessId),
    enabled: businessId.length > 0,
    staleTime: QUERY_CACHE.staleTime,
  });

  const members: MemberSummary[] =
    membersQuery.data && !("error" in membersQuery.data)
      ? membersQuery.data.data.members
      : [];
  const invites: InviteSummary[] =
    invitesQuery.data && !("error" in invitesQuery.data)
      ? invitesQuery.data.data.invites
      : [];

  const isOwner = business?.role === "OWNER";
  const canManage = business?.role === "OWNER" || business?.role === "MANAGER";

  const refreshAll = useCallback(async () => {
    await businessesQuery.refetch();
    if (businessId) {
      await Promise.all([membersQuery.refetch(), invitesQuery.refetch()]);
    }
  }, [businessesQuery, membersQuery, invitesQuery, businessId]);

  const inviteMutation = useMutation({
    mutationFn: (input: { email: string; role: Role }) =>
      inviteMember(businessId, { ...input, positionIds: [] }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: queryKeys.invites(businessId) }),
  });

  /**
   * Optimistic role change with rollback. Mirrors the swap-request pattern:
   * flip the label immediately, disable the control, roll back on failure.
   */
  const roleMutation = useMutation({
    mutationFn: (vars: { membershipId: string; role: "MANAGER" | "STAFF" }) =>
      changeMemberRole(vars.membershipId, vars.role),
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.members(businessId) });
      const previous = queryClient.getQueryData<MembersResult>(queryKeys.members(businessId));
      queryClient.setQueryData<MembersResult>(queryKeys.members(businessId), (old) =>
        patchMemberRole(old, vars.membershipId, vars.role),
      );
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.members(businessId), ctx.previous);
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.members(businessId) }),
  });

  const removeMutation = useMutation({
    mutationFn: (membershipId: string) => removeMember(membershipId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.members(businessId) }),
  });

  const resendMutation = useMutation({
    mutationFn: (inviteId: string) => resendInvite(inviteId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.invites(businessId) }),
  });

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(inviteId),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.invites(businessId) }),
  });

  const loading = businessesQuery.isLoading || membersQuery.isLoading;
  const offline =
    businessesQuery.isError && business !== null && members.length + invites.length > 0;

  return (
    <View style={styles.container}>
      <PageHead page="Team" noIndex path="/team" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={businessesQuery.isRefetching || membersQuery.isRefetching}
            onRefresh={() => void refreshAll()}
            tintColor={colors.primary}
          />
        }
      >
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
          <Text style={styles.title}>Team</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? <ActivityIndicator color={colors.primary} /> : null}

        {!loading && !business ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>No business yet</Text>
            <Text style={styles.body}>Create a business to start inviting your team.</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Create a business"
              onPress={() => router.push("/business/create")}
              style={styles.button}
            >
              <Text style={styles.buttonLabel}>Create a business</Text>
            </Pressable>
          </View>
        ) : null}

        {business ? (
          <>
            <Text style={styles.subtitle}>{business.name}</Text>
            <Text style={styles.updated}>
              {offline
                ? `Offline — showing saved team. Updated ${formatWhen(membersQuery.dataUpdatedAt)}`
                : `Updated ${formatWhen(membersQuery.dataUpdatedAt)}`}
            </Text>

            {inviteMutation.isError ? (
              <Text style={styles.error}>{errorMessage(inviteMutation.error)}</Text>
            ) : null}
            {inviteMutation.isSuccess && inviteMutation.data && !("error" in inviteMutation.data) ? (
              <Text style={styles.banner}>
                Invite sent. Code: {inviteMutation.data.data.code}
              </Text>
            ) : null}
            {roleMutation.isError ? (
              <Text style={styles.error}>{errorMessage(roleMutation.error)}</Text>
            ) : null}
            {removeMutation.isError ? (
              <Text style={styles.error}>{errorMessage(removeMutation.error)}</Text>
            ) : null}
            {resendMutation.data && !("error" in resendMutation.data) ? (
              <Text style={styles.banner}>New invite code: {resendMutation.data.data.code}</Text>
            ) : null}

            {canManage ? (
              <InviteMemberForm
                canInviteManager={isOwner}
                onSubmit={async ({ email, role }) => {
                  const res = await inviteMutation.mutateAsync({ email, role });
                  return "error" in res ? res.error.message : null;
                }}
              />
            ) : null}

            <Text style={styles.sectionHeading}>Members</Text>
            {members.map((m) => (
              <View key={m.membershipId} style={styles.row}>
                <View style={styles.rowInfo}>
                  <Text style={styles.rowName}>{m.displayName}</Text>
                  <Text style={styles.rowMeta}>
                    {m.role}
                    {m.email ? ` · ${m.email}` : ""}
                  </Text>
                </View>
                {isOwner && m.role === "STAFF" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Make ${m.displayName} a Manager`}
                    disabled={roleMutation.isPending}
                    onPress={() =>
                      roleMutation.mutate({ membershipId: m.membershipId, role: "MANAGER" })
                    }
                    style={styles.action}
                  >
                    <Text style={styles.actionLabel}>Make Manager</Text>
                  </Pressable>
                ) : null}
                {isOwner && m.role === "MANAGER" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Make ${m.displayName} Staff`}
                    disabled={roleMutation.isPending}
                    onPress={() =>
                      roleMutation.mutate({ membershipId: m.membershipId, role: "STAFF" })
                    }
                    style={styles.action}
                  >
                    <Text style={styles.actionLabel}>Make Staff</Text>
                  </Pressable>
                ) : null}
                {canManage && m.role !== "OWNER" && (isOwner || m.role === "STAFF") ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${m.displayName}`}
                    disabled={removeMutation.isPending}
                    onPress={() => removeMutation.mutate(m.membershipId)}
                    style={styles.actionDanger}
                  >
                    <Text style={styles.actionDangerLabel}>Remove</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}

            {canManage ? (
              <>
                <Text style={styles.sectionHeading}>Pending invites</Text>
                {invites.length === 0 ? (
                  <Text style={styles.body}>No pending invites.</Text>
                ) : (
                  invites.map((inv) => (
                    <View key={inv.id} style={styles.row}>
                      <View style={styles.rowInfo}>
                        <Text style={styles.rowName}>{inv.email}</Text>
                        <Text style={styles.rowMeta}>{inv.role}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Resend invite to ${inv.email}`}
                        disabled={resendMutation.isPending}
                        onPress={() => resendMutation.mutate(inv.id)}
                        style={styles.action}
                      >
                        <Text style={styles.actionLabel}>Resend</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Revoke invite to ${inv.email}`}
                        disabled={revokeMutation.isPending}
                        onPress={() => revokeMutation.mutate(inv.id)}
                        style={styles.actionDanger}
                      >
                        <Text style={styles.actionDangerLabel}>Revoke</Text>
                      </Pressable>
                    </View>
                  ))
                )}
              </>
            ) : null}
          </>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Logout"
          onPress={async () => {
            await unregisterPushNotifications();
            await endSession(false);
            queryClient.clear();
            router.replace("/auth");
          }}
          style={styles.linkButton}
        >
          <Text style={styles.linkLabel}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Immutably patch one member's role inside the cached member list. */
function patchMemberRole(
  data: MembersResult | undefined,
  membershipId: string,
  role: "MANAGER" | "STAFF",
): MembersResult | undefined {
  if (!data || "error" in data) return data;
  return {
    data: {
      members: data.data.members.map((m) =>
        m.membershipId === membershipId ? { ...m, role } : m,
      ),
    },
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function formatWhen(updatedAt: number): string {
  if (!updatedAt) return "never";
  const minutes = Math.floor((Date.now() - updatedAt) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    scroll: { alignItems: "center", gap: spacing.md, padding: spacing.lg, paddingTop: spacing.xxxl },
    headerRow: {
      width: "100%",
      maxWidth: 420,
      flexDirection: "row",
      alignItems: "center",
    },
    backIcon: { padding: spacing.xs },
    headerSpacer: { width: 32 },
    title: { ...typeStyle("headline-medium"), color: colors.onSurface, flex: 1, textAlign: "center" },
    subtitle: { ...typeStyle("title-medium"), color: colors.onSurfaceVariant },
    updated: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    sectionHeading: {
      ...typeStyle("title-medium"),
      color: colors.onSurface,
      alignSelf: "flex-start",
      maxWidth: 420,
      marginTop: spacing.md,
    },
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
    cardTitle: { ...typeStyle("title-medium"), color: colors.onSurface },
    body: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant, maxWidth: 420 },
    banner: { ...typeStyle("body-small"), color: colors.success, maxWidth: 420 },
    error: { ...typeStyle("body-small"), color: colors.error, maxWidth: 420 },
    row: {
      width: "100%",
      maxWidth: 420,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
    },
    rowInfo: { flex: 1 },
    rowName: { ...typeStyle("body-medium"), color: colors.onSurface },
    rowMeta: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    action: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    actionLabel: { ...typeStyle("body-small"), color: colors.primary },
    actionDanger: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.error,
    },
    actionDangerLabel: { ...typeStyle("body-small"), color: colors.error },
    button: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      borderRadius: radii.pill,
      marginTop: spacing.xs,
    },
    buttonLabel: { ...typeStyle("body-medium"), color: colors.onPrimary },
    linkButton: { paddingVertical: spacing.md, marginTop: spacing.md },
    linkLabel: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant },
  });
}
