import { useEffect, useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { getAccessToken } from "@/lib/secureStore";
import { PageHead } from "@/components/PageHead";
import { useTheme, type ThemeColors } from "@/theme";
import logo from "../assets/logo.png";

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
        <Image source={logo} style={styles.logo} accessibilityLabel="Rota logo" />
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
    logo: {
      width: 140,
      height: 140,
      resizeMode: "contain",
    },
  });
}
