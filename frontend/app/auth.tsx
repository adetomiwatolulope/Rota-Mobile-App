import { useState } from "react";
import { View, Text, TextInput, Button, Alert } from "react-native";
import { useRouter } from "expo-router";
import { apiPost } from "@/api/client";
import { setTokens } from "@/lib/secureStore";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export default function Auth() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!email || !password) {
      Alert.alert("Validation", "Email and password required");
      return;
    }
    setLoading(true);
    try {
      const endpoint = mode === "register" ? "/auth/register" : "/auth/login";
      const body = mode === "register" ? { email, password, name } : { email, password };
      const res = await apiPost<LoginResponse>(endpoint, body);
      if ("error" in res) {
        Alert.alert("Error", res.error.message);
        return;
      }
      await setTokens(res.data.accessToken, res.data.refreshToken);
      router.replace("/dashboard");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Rota</Text>
      {mode === "register" && (
        <TextInput placeholder="Name" value={name} onChangeText={setName} style={{ borderWidth: 1, padding: 10 }} />
      )}
      <TextInput placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" style={{ borderWidth: 1, padding: 10 }} />
      <TextInput placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry style={{ borderWidth: 1, padding: 10 }} />
      <Button title={loading ? "Submitting..." : mode === "register" ? "Register" : "Login"} onPress={submit} disabled={loading} />
      <Button title={mode === "register" ? "Have an account? Login" : "Need an account? Register"} onPress={() => setMode(mode === "register" ? "login" : "register")} />
    </View>
  );
}
