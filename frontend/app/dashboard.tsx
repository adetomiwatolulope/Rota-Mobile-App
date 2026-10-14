import { View, Text, Button } from "react-native";
import { useRouter } from "expo-router";
import { clearTokens } from "@/lib/secureStore";

export default function Dashboard() {
  const router = useRouter();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 20 }}>Dashboard</Text>
      <Text>Simple dashboard (per checkpoint 4)</Text>
      <Button title="Logout" onPress={async () => { await clearTokens(); router.replace("/auth"); }} />
    </View>
  );
}
