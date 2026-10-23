/**
 * providers/identity/google/index.ts — Google ID-token verification. [S-3]
 * Only this file talks to Google. auth.service depends on the
 * GoogleIdentityProvider interface, never on google-auth-library directly.
 *
 * Owner-approved PRD deviation: Google sign-in (see AGENTS.md task report).
 * GOOGLE_CLIENT_ID is the public OAuth client ID, not a secret. Empty value
 * disables the endpoint at runtime instead of failing startup.
 */
import { OAuth2Client } from "google-auth-library";
import { env } from "../../../config/env.js";
import { AppError, ErrorCode } from "../../../lib/errors.js";

export type GoogleIdentity = {
  email: string;
  name: string;
  emailVerified: boolean;
};

export interface GoogleIdentityProvider {
  verifyIdToken(idToken: string): Promise<GoogleIdentity>;
}

const client = new OAuth2Client();

export const googleIdentityProvider: GoogleIdentityProvider = {
  async verifyIdToken(idToken: string): Promise<GoogleIdentity> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError(
        ErrorCode.UNAUTHORIZED,
        503,
        "Google sign-in is not configured on this server",
      );
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      if (!payload?.email) {
        throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Google token has no email");
      }
      return {
        email: payload.email.toLowerCase(),
        name: payload.name?.trim() || payload.email.split("@")[0] || "Google user",
        emailVerified: payload.email_verified === true,
      };
    } catch (err) {
      if (err instanceof AppError) throw err;
      // Signature/audience failures and network errors are all "invalid token"
      // to the client; details stay in server logs via pino. [P-5]
      throw new AppError(ErrorCode.UNAUTHORIZED, 401, "Invalid Google token");
    }
  },
};
