/**
 * providers/push/expo/index.ts - Expo Push Service adapter
 */
import { AppError, ErrorCode } from "../../../lib/errors.js";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
  channelId?: string;
  priority?: "default" | "normal" | "high";
}

export interface PushResult {
  ticketId?: string;
  status: "ok" | "error";
  message?: string;
  details?: unknown;
}

export interface PushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: {
    error?: "DeviceNotRegistered" | "InvalidCredentials" | "MessageTooBig" | "MessageRateExceeded";
  };
}

export class ExpoPushProvider {
  private endpoint = "https://exp.host/--/api/v2/push/send";
  private receiptEndpoint = "https://exp.host/--/api/v2/push/getReceipts";

  async send(messages: PushMessage[]): Promise<PushResult[]> {
    if (messages.length === 0) return [];
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(messages),
      });
      if (!res.ok) {
        throw new AppError(ErrorCode.INTERNAL, 502, "Push service error");
      }
      const json: any = await res.json();
      const data = json?.data || [];
      return messages.map((_, idx) => {
        const item = data[idx] || {};
        if (item.status === "ok") {
          return { status: "ok", ticketId: item.id };
        }
        return { status: "error", message: item.message, details: item.details };
      });
    } catch (err) {
      // Return errors for all
      return messages.map(() => ({ status: "error", message: "Failed to send push" }));
    }
  }

  async getReceipts(ids: string[]): Promise<Record<string, PushReceipt>> {
    if (ids.length === 0) return {};
    try {
      const res = await fetch(this.receiptEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Accept-encoding": "gzip, deflate",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        throw new AppError(ErrorCode.INTERNAL, 502, "Push receipts error");
      }
      const json: any = await res.json();
      return json?.data || {};
    } catch (err) {
      return {};
    }
  }
}

export const expoPushProvider = new ExpoPushProvider();
