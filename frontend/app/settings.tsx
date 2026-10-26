import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import {
  getSettings,
  updateSettings,
  type UserSettings,
  type UserSettingsPatch,
} from "@/api/settings";
import { queryKeys } from "@/api/queryKeys";
import { PageHead } from "@/components/PageHead";
import { QUERY_CACHE } from "@/lib/queryClient";
import {
  hasNotificationPermission,
  requestNotificationPermission,
} from "@/features/notifications/push";
import { radii, spacing, typeStyle, useTheme, type ThemeColors } from "@/theme";

type SettingsResult = Awaited<ReturnType<typeof getSettings>>;

/**
 * Requirement 7: settings coordination.
 *
 * The server is the single source of truth. This screen loads settings on
 * focus (so a change made on another device shows up), then writes through
 * optimistically: the toggle flips immediately, the server's canonical row
 * replaces it on success, and the previous value is restored if the request
 * fails.
 */
export default function SettingsScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.settings,
    queryFn: getSettings,
    staleTime: QUERY_CACHE.staleTime,
  });

  // Another device may have changed settings while this one was backgrounded.
  useFocusEffect(
    useCallback(() => {
      void query.refetch();
    }, [query]),
  );

  const settings: UserSettings | null =
    query.data && !("error" in query.data) ? query.data.data.settings : null;

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pushAllowed, setPushAllowed] = useState<boolean | null>(null);

  const refreshPushPermission = useCallback(async () => {
    setPushAllowed(await hasNotificationPermission());
  }, []);

  // The OS permission can change outside the app (system settings), so check it
  // whenever this screen comes back into view.
  useFocusEffect(
    useCallback(() => {
      void refreshPushPermission();
    }, [refreshPushPermission]),
  );

  const mutation = useMutation({
    mutationFn: (patch: UserSettingsPatch) => updateSettings(patch),
    onMutate: async (patch) => {
      setSaveState("saving");
      await queryClient.cancelQueries({ queryKey: queryKeys.settings });
      const previous = queryClient.getQueryData<SettingsResult>(queryKeys.settings);
      queryClient.setQueryData<SettingsResult>(queryKeys.settings, (old) => {
        if (!old || "error" in old) return old;
        return {
          data: {
            settings: { ...old.data.settings, ...patch } as UserSettings,
          },
        };
      });
      return { previous };
    },
    onError: (_err, _patch, ctx) => {
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(queryKeys.settings, ctx.previous);
      }
      setSaveState("error");
    },
    onSuccess: (res) => {
      if (!("error" in res)) {
        queryClient.setQueryData<SettingsResult>(queryKeys.settings, () => {
          return { data: { settings: res.data.settings } };
        });
        setSaveState("saved");
      } else {
        setSaveState("error");
      }
    },
  });

  const patch = useCallback(
    (next: UserSettingsPatch) => {
      mutation.mutate(next);
    },
    [mutation],
  );

  if (query.isLoading) {
    return (
      <View style={styles.container}>
        <PageHead page="Settings" noIndex path="/settings" />
        <Header colors={colors} onBack={() => goBack(router)} />
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.stateText}>Loading your settings.</Text>
        </View>
      </View>
    );
  }

  if (!settings) {
    return (
      <View style={styles.container}>
        <PageHead page="Settings" noIndex path="/settings" />
        <Header colors={colors} onBack={() => goBack(router)} />
        <View style={styles.state}>
          <Text style={styles.stateTitle}>Could not load settings</Text>
          <Text style={styles.stateText}>Check your connection and try again.</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry loading settings"
            style={styles.retry}
            onPress={() => void query.refetch()}
          >
            <Text style={styles.retryLabel}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PageHead page="Settings" noIndex path="/settings" />
      <Header colors={colors} onBack={() => goBack(router)} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <SaveStatus state={saveState} styles={styles} />

        <Section title="Notifications" styles={styles}>
          {Platform.OS !== "web" ? (
            <View style={styles.row}>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>Device notifications</Text>
                <Text style={styles.rowDescription}>
                  {pushAllowed
                    ? "Allowed on this device."
                    : "Turn on to receive shift and billing alerts."}
                </Text>
              </View>
              {pushAllowed ? (
                <Ionicons
                  name="checkmark-circle"
                  size={24}
                  color={colors.primary}
                />
              ) : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Allow notifications on this device"
                  style={styles.permissionButton}
                  onPress={async () => {
                    const allowed = await requestNotificationPermission();
                    setPushAllowed(allowed);
                  }}
                >
                  <Text style={styles.permissionLabel}>Turn on</Text>
                </Pressable>
              )}
            </View>
          ) : null}
          <ToggleRow
            label="Shift changes"
            description="New, moved, and cancelled shifts."
            value={settings.shiftChanges}
            onValueChange={(v) => patch({ shiftChanges: v })}
            styles={styles}
          />
          <ToggleRow
            label="Swaps and claims"
            description="Swap offers, approvals, and open-shift claims."
            value={settings.swaps}
            onValueChange={(v) => patch({ swaps: v })}
            styles={styles}
          />
          <ToggleRow
            label="Reminders"
            description="The two-hour shift reminder and acknowledgement reminders."
            value={settings.reminders}
            onValueChange={(v) => patch({ reminders: v })}
            styles={styles}
          />
          <ToggleRow
            label="Billing"
            description="Trial, payment, and subscription alerts."
            value={settings.billing}
            onValueChange={(v) => patch({ billing: v })}
            styles={styles}
          />
        </Section>

        <Section title="Quiet hours" styles={styles}>
          <ToggleRow
            label="Enable quiet hours"
            description="Non-urgent notifications are delayed until quiet hours end."
            value={settings.quietHoursEnabled}
            onValueChange={(v) => patch({ quietHoursEnabled: v })}
            styles={styles}
          />
          <QuietHoursField
            label="Start"
            minutes={settings.quietHoursStart}
            disabled={!settings.quietHoursEnabled}
            onCommit={(minutes) => patch({ quietHoursStart: minutes })}
            styles={styles}
            colors={colors}
          />
          <QuietHoursField
            label="End"
            minutes={settings.quietHoursEnd}
            disabled={!settings.quietHoursEnabled}
            onCommit={(minutes) => patch({ quietHoursEnd: minutes })}
            styles={styles}
            colors={colors}
          />
          <FieldRow label="Time zone" styles={styles}>
            <TextInput
              accessibilityLabel="Time zone"
              defaultValue={settings.timezone}
              onEndEditing={(event) =>
                patch({ timezone: event.nativeEvent.text.trim() || settings.timezone })
              }
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder="Africa/Lagos"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </FieldRow>
          <Text style={styles.help}>
            Quiet hours are checked on the server in this time zone before a push is sent.
          </Text>
        </Section>

        <Section title="App" styles={styles}>
          <FieldRow label="Language" styles={styles}>
            <TextInput
              accessibilityLabel="Language"
              defaultValue={settings.language}
              onEndEditing={(event) =>
                patch({ language: event.nativeEvent.text.trim() || settings.language })
              }
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              placeholder="en"
              placeholderTextColor={colors.onSurfaceVariant}
            />
          </FieldRow>
          <FieldRow label="Theme" styles={styles}>
            <View style={styles.themeRow}>
              {(["system", "light", "dark"] as const).map((choice) => (
                <Pressable
                  key={choice}
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${choice} theme`}
                  accessibilityState={{ selected: settings.theme === choice }}
                  onPress={() => patch({ theme: choice })}
                  style={[
                    styles.themeChoice,
                    settings.theme === choice && styles.themeChoiceActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.themeChoiceLabel,
                      settings.theme === choice && styles.themeChoiceLabelActive,
                    ]}
                  >
                    {choice[0]!.toUpperCase() + choice.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </FieldRow>
        </Section>

        <Text style={styles.help}>
          Settings are stored on the server and shared across your devices. The most
          recent change wins; if two devices save at once, one change may be
          overwritten.
        </Text>
      </ScrollView>
    </View>
  );
}

function goBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) router.back();
  else router.replace("/dashboard");
}

function Header({
  colors,
  onBack,
}: {
  colors: ThemeColors;
  onBack: () => void;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={styles.backIcon}
        hitSlop={8}
      >
        <Ionicons name="arrow-back" size={24} color={colors.onSurface} />
      </Pressable>
      <Text style={styles.title}>Settings</Text>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function SaveStatus({
  state,
  styles,
}: {
  state: "idle" | "saving" | "saved" | "error";
  styles: ReturnType<typeof createStyles>;
}) {
  if (state === "idle") return null;
  const label =
    state === "saving"
      ? "Saving…"
      : state === "saved"
        ? "Saved to your account"
        : "Could not save. Previous value restored.";
  return <Text style={styles.status}>{label}</Text>;
}

function Section({
  title,
  children,
  styles,
}: {
  title: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
  styles,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDescription}>{description}</Text>
      </View>
      <Switch
        accessibilityLabel={label}
        value={value}
        onValueChange={onValueChange}
      />
    </View>
  );
}

function FieldRow({
  label,
  children,
  styles,
}: {
  label: string;
  children: React.ReactNode;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {children}
    </View>
  );
}

function QuietHoursField({
  label,
  minutes,
  disabled,
  onCommit,
  styles,
  colors,
}: {
  label: string;
  minutes: number | null;
  disabled: boolean;
  onCommit: (minutes: number | null) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ThemeColors;
}) {
  const [text, setText] = useState(minutes == null ? "" : formatMinutes(minutes));
  useEffect(() => {
    setText(minutes == null ? "" : formatMinutes(minutes));
  }, [minutes]);

  return (
    <FieldRow label={label} styles={styles}>
      <TextInput
        accessibilityLabel={`Quiet hours ${label.toLowerCase()}`}
        value={text}
        editable={!disabled}
        onChangeText={setText}
        onEndEditing={() => {
          const parsed = parseMinutes(text);
          if (parsed !== undefined) onCommit(parsed);
          else setText(minutes == null ? "" : formatMinutes(minutes));
        }}
        placeholder="22:00"
        placeholderTextColor={colors.onSurfaceVariant}
        keyboardType="numbers-and-punctuation"
        style={[styles.input, disabled && styles.inputDisabled]}
      />
    </FieldRow>
  );
}

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function parseMinutes(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return undefined;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours < 0 || hours > 23 || mins < 0 || mins > 59) return undefined;
  return hours * 60 + mins;
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
    title: {
      ...typeStyle("headline-medium"),
      color: colors.onSurface,
      flex: 1,
      textAlign: "center",
    },
    content: {
      padding: spacing.lg,
      paddingBottom: spacing.xxxl,
      gap: spacing.lg,
    },
    status: {
      ...typeStyle("body-small"),
      color: colors.onSurfaceVariant,
      textAlign: "center",
    },
    section: { gap: spacing.sm },
    sectionTitle: { ...typeStyle("title-medium"), color: colors.onSurface },
    card: {
      borderRadius: radii.lg,
      backgroundColor: colors.surfaceContainer,
      borderWidth: 1,
      borderColor: colors.outline,
      overflow: "hidden",
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.outline,
    },
    rowText: { flex: 1, gap: 2 },
    rowLabel: { ...typeStyle("body-medium"), color: colors.onSurface, flex: 1 },
    rowDescription: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
    input: {
      ...typeStyle("body-medium"),
      color: colors.onSurface,
      minWidth: 96,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
      borderWidth: 1,
      borderColor: colors.outline,
      textAlign: "right",
    },
    inputDisabled: { opacity: 0.4 },
    themeRow: { flexDirection: "row", gap: spacing.xs },
    themeChoice: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    permissionButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    permissionLabel: { ...typeStyle("body-small"), color: colors.primary },
    themeChoiceActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    themeChoiceLabel: { ...typeStyle("body-small"), color: colors.onSurface },
    themeChoiceLabelActive: { color: colors.onPrimary },
    help: { ...typeStyle("body-small"), color: colors.onSurfaceVariant },
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
    retryLabel: { ...typeStyle("body-medium"), color: colors.primary },
  });
}
