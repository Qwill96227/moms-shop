import { logger } from "./logger";

/**
 * Monitoring & alerts layer. Sends a short message to a Slack or Discord
 * incoming webhook (ALERT_WEBHOOK_URL) and, for order news, an email to Mom
 * through Resend (RESEND_API_KEY + ORDER_NOTIFY_EMAIL). Every channel is
 * optional; alerts never throw.
 */
export async function sendAlert(text: string, level: "info" | "warn" | "error" = "info") {
  logger[level]({ alert: true }, text);
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, content: text }),
      signal: AbortSignal.timeout(4000),
    });
  } catch (err) {
    logger.warn({ err }, "alert webhook failed");
  }
}

export async function sendEmail(to: string, subject: string, body: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? "Shop <onboarding@resend.dev>",
        to: [to],
        reply_to: process.env.NEXT_PUBLIC_CONTACT_EMAIL,
        subject,
        text: body,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) logger.warn({ status: res.status }, "email failed");
    return res.ok;
  } catch (err) {
    logger.warn({ err }, "email failed");
    return false;
  }
}

export async function emailOwner(subject: string, body: string) {
  const to = process.env.ORDER_NOTIFY_EMAIL;
  if (to) await sendEmail(to, subject, body);
}
