import { useEffect } from "react";
import { View, Text } from "react-native";
import { useRouter } from "expo-router";
import { getAccessToken } from "@/lib/secureStore";

export default function Splash() {
  const router = useRouter();
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
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <Text>Rota</Text>
    </View>
  );
}
