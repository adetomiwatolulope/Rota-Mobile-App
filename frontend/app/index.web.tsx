import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Header, type LandingView } from "@/components/Header";
import { ContactForm } from "@/components/ContactForm";
import { PageHead } from "@/components/PageHead";
import { DEFAULT_DESCRIPTION } from "@/lib/seo";
import {
  radii,
  spacing,
  typeStyle,
  useTheme,
  type ThemeColors,
} from "@/theme";

// The browser-tab title tracks the section the header link selected.
const VIEW_TITLES: Record<LandingView, string | undefined> = {
  home: undefined,
  testimonials: "Testimonials",
  contact: "Contact",
};

// Single-page marketing site. The native entry (`index.tsx`) still redirects to
// /splash. All sections live on this one route and render conditionally.
export default function Landing() {
  const [view, setView] = useState<LandingView>("home");
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.page}>
      <PageHead path="/" page={VIEW_TITLES[view]} />
      <Header onNavigate={setView} />
      <View style={styles.content}>
        {view === "home" && (
          <View style={styles.hero}>
            <Text style={styles.tagline}>
              Shift scheduling for small businesses
            </Text>
            <Text style={styles.description}>{DEFAULT_DESCRIPTION}</Text>
          </View>
        )}
        {view === "testimonials" && (
          <View style={styles.testimonials}>
            <View style={styles.intro}>
              <Text style={styles.heading}>Testimonials</Text>
              <Text style={styles.subheading}>
                Hear from teams using Rota to run their shifts.
              </Text>
            </View>
            <View style={styles.list}>
              {TESTIMONIALS.map((item) => (
                <View key={item.attribution} style={styles.card}>
                  <Text style={styles.quote}>{item.quote}</Text>
                  <Text style={styles.attribution}>{item.attribution}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
        {view === "contact" && (
          <View style={styles.contact}>
            <View style={styles.intro}>
              <Text style={styles.heading}>Contact</Text>
              <Text style={styles.subheading}>
                Send us a message and we'll reply by email.
              </Text>
            </View>
            <ContactForm />
          </View>
        )}
      </View>
    </View>
  );
}

// Placeholder quotes until real customers exist; wording is intentionally
// generic and carries no personal data. [P-8]
const TESTIMONIALS = [
  {
    quote:
      "We moved the whole team onto Rota in a week. Shift changes finally stop getting lost in the group chat.",
    attribution: "Owner — restaurant, Lagos",
  },
  {
    quote:
      "Managers publish the week in minutes, and staff see the update straight away.",
    attribution: "Manager — retail store, Abuja",
  },
  {
    quote: "The uncovered-shift flag alone has saved us weekends.",
    attribution: "Co-owner — clinic, Lagos",
  },
];

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    page: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      flexGrow: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.sm,
    },
    // Hero block keeps the tagline and its supporting copy tightly grouped,
    // independent of the wider content gap used by the other views.
    hero: {
      alignItems: "center",
      gap: spacing.sm,
    },
    // Hero display text uses the display/small type style (Lora 600).
    tagline: {
      ...typeStyle("display-small"),
      textAlign: "center",
      color: colors.onSurface,
    },
    heading: {
      ...typeStyle("display-small"),
      textAlign: "center",
      color: colors.onSurface,
    },
    subheading: {
      ...typeStyle("body-large"),
      textAlign: "center",
      color: colors.onSurfaceVariant,
    },
    // Fixed measure so the supporting copy wraps well short of the viewport,
    // regardless of screen width (narrower than the tagline/hero display text).
    description: {
      maxWidth: 480,
      ...typeStyle("body-large"),
      textAlign: "center",
      color: colors.onSurfaceVariant,
    },
    // Section shells keep the intro block and its content (quotes, form)
    // grouped with a wider gap than the home hero.
    testimonials: {
      alignItems: "center",
      gap: spacing.xl,
    },
    contact: {
      alignItems: "center",
      gap: spacing.xl,
    },
    intro: {
      alignItems: "center",
      gap: spacing.sm,
    },
    list: {
      width: "100%",
      maxWidth: 560,
      gap: spacing.base,
    },
    card: {
      borderWidth: 1,
      borderColor: colors.outline,
      borderRadius: radii.md,
      backgroundColor: colors.surfaceContainer,
      padding: spacing.lg,
      gap: spacing.sm,
    },
    quote: {
      ...typeStyle("body-large"),
      color: colors.onSurface,
    },
    attribution: {
      ...typeStyle("body-small"),
      color: colors.onSurfaceVariant,
    },
  });
}
