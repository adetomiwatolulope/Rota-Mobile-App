import { useEffect, useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getAccessToken } from "@/lib/secureStore";
import { PageHead } from "@/components/PageHead";
import { typeStyle, useTheme, type ThemeColors } from "@/theme";

export default function Splash() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      if (token) {
        router.replace("/dashboard");
      } else {
        router.replace("/auth");
      }
    })();
  }, [router]);

  return (
    <>
      <PageHead noIndex path="/splash" />
      <View style={styles.container}>
        <Text style={styles.wordmark}>Rota</Text>
      </View>
    </>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.surface,
    },
    wordmark: {
      ...typeStyle("display-small"),
      color: colors.primary,
    },
  });
}
