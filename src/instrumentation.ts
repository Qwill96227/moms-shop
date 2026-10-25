import type { Instrumentation } from "next";

// Error tracking layer: every unhandled server error is logged with its route
// and forwarded to the alert channel. Add Sentry here later if you want
// stack-trace grouping (npx @sentry/wizard -i nextjs).
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  const { logger } = await import("./lib/logger");
  const { sendAlert } = await import("./lib/alerts");
  const e = err as Error & { digest?: string };
  logger.error({ err: e, path: request.path, method: request.method, route: context.routePath, digest: e.digest }, "unhandled request error");
  await sendAlert(`🚨 Error on ${request.method} ${request.path}: ${e.message}`, "error");
};
