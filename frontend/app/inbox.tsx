import { useCallback, useMemo } from "react";
import { ActivityIndicator, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type { NotificationItem } from "@rota/shared";
import {
  listNotifications,
  markNotificationRead,
  type InboxPage,
} from "@/api/notifications";
import { queryKeys } from "@/api/queryKeys";
import { QUERY_CACHE } from "@/lib/queryClient";
import { PageHead } from "@/components/PageHead";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type InboxResult = Awaited<ReturnType<typeof listNotifications>>;

/**
 * FR-045: the in-app inbox. Server data comes from TanStack Query (infinite
 * cursor pagination, PRD 7.1); the cache is persisted so it can be read offline.
 * Marking read is optimistic with rollback. `isFetchingNextPage` from the query
 * is the single guard against duplicate page requests on fast scroll.
 */
export default function Inbox() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey: queryKeys.notifications,
    queryFn: ({ pageParam }) => listNotifications(pageParam, QUERY_CACHE.inboxPageSize),
    initialPageParam: null as string | null,
    getNextPageParam: (last) =>
      "error" in last ? undefined : (last.data.nextCursor ?? undefined),
    staleTime: QUERY_CACHE.inboxStaleTime,
  });

  const pages = query.data?.pages ?? [];
  const items: NotificationItem[] = pages.flatMap((p) => ("error" in p ? [] : p.data.items));
  const unreadCount = firstUnreadCount(pages);
  const offline = query.isError && items.length > 0;

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(id),
    // Optimistic: flip the row and decrement the badge before the server replies.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notifications });
      const previous =
        queryClient.getQueryData<InfiniteData<InboxResult>>(queryKeys.notifications);
      queryClient.setQueryData<InfiniteData<InboxResult>>(
        queryKeys.notifications,
        (old) => patchRead(old, id),
      );
      return { previous };
    },
    // Rollback on failure so the row shows unread again.
    onError: (_err, _id, ctx) => {
      if (ctx?.previous) {
        queryClient.setQueryData(queryKeys.notifications, ctx.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.notifications });
    },
  });

  const handlePress = useCallback(
    (item: NotificationItem) => {
      if (item.readAt || markRead.isPending) return;
      markRead.mutate(item.id);
    },
    [markRead],
  );

  const onRefresh = useCallback(() => void query.refetch(), [query]);
  const onEndReached = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
  }, [query]);

  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Notification: ${item.title}${item.readAt ? "" : ", unread"}`}
        onPress={() => handlePress(item)}
        style={[styles.row, item.readAt ? null : styles.rowUnread]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle}>{item.title}</Text>
          {!item.readAt ? <View style={styles.dot} /> : null}
        </View>
        <Text style={styles.rowBody}>{item.body}</Text>
        <Text style={styles.rowMeta}>{formatWhen(item.createdAt)}</Text>
      </Pressable>
    ),
    [handlePress, styles],
  );

  return (
    <View style={styles.container}>
      <PageHead page="Inbox" noIndex path="/inbox" />
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard"))}
          style={styles.backIcon}
          hitSlop={8}
        >
          <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Inbox</Text>
        <View style={styles.headerSpacer} />
      </View>
      <View style={styles.statusRow}>
        {unreadCount > 0 ? <Text style={styles.unread}>{unreadCount} unread</Text> : null}
        <Text style={styles.updated}>{lastUpdated(query.dataUpdatedAt)}</Text>
      </View>

      {query.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading your inbox…</Text>
        </View>
      ) : query.isError && items.length === 0 ? (
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Could not load your inbox</Text>
          <Text style={styles.stateText}>{errorMessage(query.error)}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading inbox"
            onPress={() => void query.refetch()}
            style={styles.retry}
          >
            <Text style={styles.retryLabel}>Try again</Text>
          </Pressable>
        </View>
      ) : (
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching && !query.isFetchingNextPage}
              onRefresh={onRefresh}
              tintColor={colors.primary}
            />
          }
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.state}>
              <Text style={styles.stateTitle}>Your inbox is empty</Text>
              <Text style={styles.stateText}>
                Shift updates, swaps, and reminders will appear here.
              </Text>
            </View>
          }
          ListFooterComponent={
            <View style={styles.footer}>
              {query.isFetchingNextPage ? <ActivityIndicator color={colors.primary} /> : null}
              {!query.hasNextPage && items.length > 0 ? (
                <Text style={styles.stateText}>You&apos;re all caught up</Text>
              ) : null}
              {offline ? (
                <Text style={styles.stateText}>
                  Showing saved inbox. {lastUpdated(query.dataUpdatedAt)}
                </Text>
              ) : null}
            </View>
          }
        />
      )}
    </View>
  );
}

/** Immutably patch one notification to read across every cached page. */
function patchRead(
  data: InfiniteData<InboxResult> | undefined,
  id: string,
): InfiniteData<InboxResult> | undefined {
  if (!data) return data;
  let decremented = false;
  const pages = data.pages.map((page) => {
    if ("error" in page) return page;
    let changed = false;
    const items = page.data.items.map((n) => {
      if (n.id === id && !n.readAt) {
        changed = true;
        decremented = true;
        return { ...n, readAt: new Date().toISOString() };
      }
      return n;
    });
    if (!changed) return page;
    return {
      ...page,
      data: {
        ...page.data,
        items,
        unreadCount: Math.max(0, page.data.unreadCount - 1),
      },
    };
  });
  return { ...data, pages: decremented ? pages : data.pages };
}

function firstUnreadCount(pages: InboxResult[]): number {
  for (const page of pages) {
    if (!("error" in page)) return page.data.unreadCount;
  }
  return 0;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong";
}

function formatWhen(iso: string): string {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** Visible "last updated" time for the persisted cache. */
function lastUpdated(updatedAt: number): string {
  if (!updatedAt) return "";
  return `Updated ${formatWhen(new Date(updatedAt).toISOString())}`;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.surface },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xxxl,
      paddingBottom: spacing.xs,
    },
    backIcon: { padding: spacing.xs },
    headerSpacer: { width: 32 },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      paddingBottom: spacing.md,
    },
    title: {
      ...typeStyle("headline-medium"),
      color: colors.onSurface,
      flex: 1,
      textAlign: "center",
    },
    unread: { ...typeStyle("label-medium"), color: colors.primary },
    updated: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
    row: {
      gap: spacing.xs,
      padding: spacing.md,
      marginBottom: spacing.sm,
      borderRadius: radii.md,
      borderWidth: 1,
      borderColor: colors.outline,
      backgroundColor: colors.surface,
    },
    rowUnread: { backgroundColor: colors.surfaceContainer, borderColor: colors.primary },
    rowHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
    rowTitle: { ...typeStyle("title-medium"), color: colors.onSurface, flex: 1 },
    dot: { width: 8, height: 8, borderRadius: radii.pill, backgroundColor: colors.primary },
    rowBody: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant },
    rowMeta: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    state: { alignItems: "center", justifyContent: "center", gap: spacing.sm, padding: spacing.xl },
    stateTitle: { ...typeStyle("title-medium"), color: colors.onSurface, textAlign: "center" },
    stateText: { ...typeStyle("body-medium"), color: colors.onSurfaceVariant, textAlign: "center" },
    retry: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
      marginTop: spacing.xs,
    },
    retryLabel: { ...typeStyle("body-small"), color: colors.primary },
    footer: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.lg },
  });
}
