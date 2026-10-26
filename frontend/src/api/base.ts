import Constants from "expo-constants";

const FALLBACK_API_BASE = "http://127.0.0.1:4000/v1";
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function resolveApiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL ?? FALLBACK_API_BASE;
  const metroHost = Constants.expoConfig?.hostUri?.split(":")[0];
  if (!metroHost || !IPV4.test(metroHost)) return configured;
  return configured.replace(/^(https?:\/\/)[^/:]+/, `$1${metroHost}`);
}

export const API_BASE = resolveApiBase();
