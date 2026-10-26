import { useEffect } from "react";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as SplashScreen from "expo-splash-screen";
import { DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold } from "@expo-google-fonts/dm-sans";
import { Lora_600SemiBold } from "@expo-google-fonts/lora";
import { AppProviders } from "@/providers/AppProviders";
import {
  configureNotifications,
  useNotificationRouting,
} from "@/features/notifications/push";

// Keep the native splash screen up until the fonts have settled, so the first
// painted frame already uses the design-system families. If loading fails we
// still render (with fallback fonts) rather than leaving a blank screen.
void SplashScreen.preventAutoHideAsync();

// The foreground handler must exist before the first notification arrives.
configureNotifications();

// Native root layout. Loads the two design-system families once so the exact
// family names in the type tokens resolve. Each weight is registered as its own
// family because React Native does not select a weight from one family.
export default function RootLayout() {
  useNotificationRouting();
  const [fontsLoaded, fontError] = useFonts({
    Lora_600SemiBold,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <AppProviders>
      <SafeAreaProvider>
        <StatusBar style="auto" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </AppProviders>
  );
}
