// lib/webpush.ts
import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

let configured = false;

/**
 * Configure web-push with VAPID keys exactly once. Returns false (and disables
 * push) if keys are missing so the rest of the system keeps working.
 */
export function ensureWebPushConfigured(): boolean {
  if (configured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC_KEY;
}

export interface PushTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/**
 * Send a push payload to a single subscription.
 * Resolves to { ok } or { gone } when the subscription is expired (404/410)
 * so the caller can prune it. Never throws.
 */
export async function sendPush(
  target: PushTarget,
  payload: Record<string, any>
): Promise<{ ok: boolean; gone?: boolean }> {
  if (!ensureWebPushConfigured()) return { ok: false };

  try {
    await webpush.sendNotification(
      {
        endpoint: target.endpoint,
        keys: target.keys,
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 * 24 } // keep for up to a day if device is offline
    );
    return { ok: true };
  } catch (err: any) {
    const statusCode = err?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, gone: true };
    }
    console.error("[webpush] send failed:", statusCode, err?.body || err?.message);
    return { ok: false };
  }
}
