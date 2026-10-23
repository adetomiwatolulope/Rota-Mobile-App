import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProviders } from "@/providers/AppProviders";
// Import the generated design tokens once, globally, so every route can reach
// the --color-*, --space-*, --typography-* and --shadow-* custom properties.
import "../../design-tokens.css";

// Web root layout. Renders the matched route without a native navigator header.
// SafeAreaProvider supplies insets (from the CSS safe-area env values) so shared
// screens that read useSafeAreaInsets() also run on web.
export default function WebLayout() {
  return (
    <AppProviders>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </AppProviders>
  );
}
