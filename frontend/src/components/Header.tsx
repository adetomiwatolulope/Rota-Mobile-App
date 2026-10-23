import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  headerHeight,
  radii,
  spacing,
  typeStyle,
  useTheme,
  type ThemeColors,
} from "@/theme";

export type LandingView = "home" | "testimonials" | "contact";

const NAV_ITEMS: { label: string; view: LandingView }[] = [
  { label: "Testimonials", view: "testimonials" },
  { label: "Contact", view: "contact" },
];

type HeaderProps = {
  onNavigate: (view: LandingView) => void;
};

export function Header({ onNavigate }: HeaderProps) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const navigate = (view: LandingView) => {
    setIsMenuOpen(false);
    onNavigate(view);
  };

  return (
    <>
      <View style={styles.container} nativeID="site-header">
        <Pressable
          href="#"
          style={styles.brand}
          accessibilityRole="link"
          accessibilityLabel="Rota home"
          onPress={() => navigate("home")}
        >
          <Image
            source={{ uri: "/favicon.svg" }}
            style={styles.logo}
            accessibilityLabel="Rota logo"
          />
          <Text style={styles.wordmark}>Rota</Text>
        </Pressable>

        {/* Hidden below the mobile breakpoint (see +html.tsx) and replaced by
            the hamburger drawer. */}
        <View style={styles.nav} nativeID="site-nav" pointerEvents="box-none">
          {NAV_ITEMS.map((item) => (
            <Pressable
              key={item.view}
              accessibilityRole="link"
              accessibilityLabel={item.label}
              style={styles.navItem}
              onPress={() => navigate(item.view)}
            >
              <Text style={styles.navLabel}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.actions}>
          <View nativeID="site-cta">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              style={styles.cta}
            >
              <Text style={styles.ctaLabel}>Get Started</Text>
            </Pressable>
          </View>
          <Pressable
            nativeID="site-menu-button"
            accessibilityRole="button"
            accessibilityLabel="Open menu"
            style={styles.menuButton}
            onPress={() => setIsMenuOpen(true)}
          >
            <View style={styles.menuBar} />
            <View style={styles.menuBar} />
            <View style={styles.menuBar} />
          </Pressable>
        </View>
      </View>

      {isMenuOpen && (
        <View style={styles.drawer} nativeID="site-drawer">
          <View style={styles.drawerHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close menu"
              style={styles.closeButton}
              onPress={() => setIsMenuOpen(false)}
            >
              <View style={styles.closeIcon}>
                <View style={[styles.closeBar, styles.closeBarForward]} />
                <View style={[styles.closeBar, styles.closeBarBackward]} />
              </View>
            </Pressable>
          </View>
          <View style={styles.drawerNav}>
            {NAV_ITEMS.map((item) => (
              <Pressable
                key={item.view}
                accessibilityRole="link"
                accessibilityLabel={item.label}
                style={styles.drawerNavItem}
                onPress={() => navigate(item.view)}
              >
                <Text style={styles.drawerNavLabel}>{item.label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Get started"
              style={styles.drawerCta}
            >
              <Text style={styles.drawerCtaLabel}>Get Started</Text>
            </Pressable>
          </View>
        </View>
      )}
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      height: headerHeight,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      backgroundColor: colors.surfaceContainer,
      borderBottomWidth: 1,
      borderBottomColor: colors.outline,
    },
    brand: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    logo: {
      width: 32,
      height: 32,
      borderRadius: radii.sm,
    },
    wordmark: {
      ...typeStyle("title-large"),
      color: colors.primary,
    },
    nav: {
      position: "absolute",
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xl,
    },
    navItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
    },
    navLabel: {
      ...typeStyle("body-medium"),
      color: colors.onSurfaceVariant,
    },
    actions: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
    },
    cta: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: radii.pill,
    },
    ctaLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
    // Hamburger, shown only below the mobile breakpoint.
    menuButton: {
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      borderRadius: radii.sm,
    },
    menuBar: {
      width: 22,
      height: 2,
      borderRadius: 2,
      backgroundColor: colors.onSurface,
    },
    // Full-screen drawer opened from the hamburger on mobile.
    drawer: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      backgroundColor: colors.surfaceContainer,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xl,
    },
    drawerHeader: {
      alignItems: "flex-end",
    },
    closeButton: {
      padding: spacing.sm,
      borderRadius: radii.sm,
    },
    closeIcon: {
      width: 24,
      height: 24,
      alignItems: "center",
      justifyContent: "center",
    },
    closeBar: {
      position: "absolute",
      width: 22,
      height: 2,
      borderRadius: 2,
      backgroundColor: colors.onSurface,
    },
    closeBarForward: {
      transform: [{ rotate: "45deg" }],
    },
    closeBarBackward: {
      transform: [{ rotate: "-45deg" }],
    },
    drawerNav: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
    },
    drawerNavItem: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radii.sm,
    },
    drawerNavLabel: {
      ...typeStyle("title-large"),
      color: colors.onSurface,
    },
    drawerCta: {
      width: "100%",
      alignItems: "center",
      backgroundColor: colors.primary,
      paddingVertical: spacing.base,
      borderRadius: radii.pill,
    },
    drawerCtaLabel: {
      ...typeStyle("body-medium"),
      color: colors.onPrimary,
    },
  });
}
