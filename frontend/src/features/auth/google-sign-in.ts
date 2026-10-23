/**
 * features/auth/google-sign-in.ts — Google sign-in hook for the auth screen.
 * Owner-approved PRD deviation (Google OAuth is not in the PRD).
 *
 * The hook opens Google's consent screen and returns an ID token; the calling
 * screen posts it to POST /v1/auth/google, which is the only party that talks
 * to Google's verification API. The app never holds a provider secret — the
 * client ID below is public. [S-4, P-6]
 */
import * as WebBrowser from "expo-web-browser";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";

// Completed authorizations open back into the app through the browser.
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ?? "";

export type GoogleSignIn = {
  isConfigured: boolean;
  isReady: boolean;
  promptAsync: () => Promise<void>;
  idToken: string | null;
  isCancelled: boolean;
};

export function useGoogleSignIn(): GoogleSignIn {
  // The hook cannot run conditionally, so an unset client ID uses a dummy
  // value; isConfigured keeps the button from ever prompting with it.
  const [request, response, promptAsync] = useIdTokenAuthRequest({
    androidClientId: GOOGLE_CLIENT_ID || "missing-client-id",
    selectAccount: true,
  });

  const isConfigured = GOOGLE_CLIENT_ID.length > 0;
  const isSuccess = response?.type === "success";
  const idToken = isSuccess ? (response.params.id_token ?? null) : null;

  return {
    isConfigured,
    isReady: request !== null,
    idToken,
    isCancelled: response?.type === "dismiss" || response?.type === "cancel",
    promptAsync: async () => {
      if (!isConfigured || !request) return;
      await promptAsync();
    },
  };
}
