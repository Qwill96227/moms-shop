import pino from "pino";

// Error tracking & logs layer: structured JSON logs that Vercel (or any log
// drain like Better Stack / Axiom / Datadog) can search and alert on.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === "test" ? "silent" : "info"),
  base: { service: "moms-shop", env: process.env.VERCEL_ENV ?? process.env.NODE_ENV },
  redact: { paths: ["*.password", "*.passwordHash", "*.email", "req.headers.cookie"], censor: "[redacted]" },
});
