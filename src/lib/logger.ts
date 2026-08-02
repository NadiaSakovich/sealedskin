/**
 * Structured server-side logging, duplicated to Better Stack.
 *
 * Every line goes to BOTH the console (so Vercel's own runtime logs keep
 * working, and local `npm run dev` is unchanged) and, when a source token is
 * configured, to Better Stack. Without `BETTER_STACK_SOURCE_TOKEN` the logger
 * degrades to console-only — no crash, no missing-env failure — so local
 * development and preview deploys work with no extra setup.
 *
 * Vercel's Log Drains would be the other way to get logs into Better Stack,
 * but drains are a Pro-plan feature; shipping from the app works on Hobby.
 *
 * Serverless caveat: a function can be frozen the moment it returns, so
 * batched logs would be lost. Writes are therefore flushed on a short debounce
 * and, at the end of a request, awaited via {@link flushLogs}.
 */
import { Logtail } from "@logtail/node";

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/** Fields identifying who a log line belongs to. See {@link userContext}. */
export interface UserContext {
  /** Firebase uid when signed in, else the client's anonymous id. Always set. */
  userId: string;
  /** The anonymous id, kept even after sign-in so a session can be followed across it. */
  sessionId?: string;
  /** Signed-in email. Present only for verified tokens — never from client input. */
  email?: string;
  /** Whether the request carried a verified Firebase token. */
  signedIn: boolean;
}

type LogData = Record<string, unknown>;

class Logger {
  private logtail: Logtail | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly minLevel: LogLevel;

  constructor() {
    const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
    const endpoint = process.env.BETTER_STACK_INGESTING_URL;

    const envLevel = (process.env.LOG_LEVEL || "info").toLowerCase();
    this.minLevel = (
      envLevel in LOG_LEVEL_PRIORITY ? envLevel : "info"
    ) as LogLevel;

    if (sourceToken) {
      try {
        this.logtail = new Logtail(sourceToken, {
          ...(endpoint ? { endpoint } : {}),
        });
      } catch (e) {
        // Never let logging setup break a request.
        console.warn("Better Stack logger init failed; console only:", e);
      }
    }
  }

  /** True when logs are actually being shipped (vs. console-only). */
  get shipping(): boolean {
    return this.logtail !== null;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] >= LOG_LEVEL_PRIORITY[this.minLevel];
  }

  /**
   * Debounced flush, so a burst of log calls in one request costs one delivery.
   * Errors are swallowed: a logging failure must never surface to the user.
   */
  private scheduleFlush() {
    if (!this.logtail || this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.logtail?.flush().catch(() => {});
    }, 100);
  }

  private write(level: LogLevel, message: string, data?: LogData) {
    if (!this.shouldLog(level)) return;

    // Console first, so Vercel's runtime logs are never worse than before.
    const consoleFn =
      level === "error"
        ? console.error
        : level === "warn"
          ? console.warn
          : console.log;
    consoleFn(message, data ? JSON.stringify(data) : "");

    if (this.logtail) {
      // Fire-and-forget: awaiting each write would add latency to the request.
      void this.logtail[level](message, data).catch(() => {});
      this.scheduleFlush();
    }
  }

  debug(message: string, data?: LogData) {
    this.write("debug", message, data);
  }
  info(message: string, data?: LogData) {
    this.write("info", message, data);
  }
  warn(message: string, data?: LogData) {
    this.write("warn", message, data);
  }
  error(message: string, data?: LogData) {
    this.write("error", message, data);
  }

  /**
   * Await delivery of anything buffered. Call before a route handler returns,
   * otherwise the function may freeze with logs still in the batch.
   */
  async flush(): Promise<void> {
    if (!this.logtail) return;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    try {
      await this.logtail.flush();
    } catch {
      /* delivery failures must not fail the request */
    }
  }
}

export const logger = new Logger();

/** Await buffered log delivery. Safe to call when logging is console-only. */
export const flushLogs = () => logger.flush();

/**
 * Build the per-user fields for a log line.
 *
 * `userId` is the Firebase uid when the request carried a verified token, and
 * the client's anonymous id otherwise — so every line is attributable and a
 * single person can be followed from their first anonymous quiz through to
 * their saved routines.
 */
export function userContext(args: {
  uid?: string | null;
  email?: string | null;
  anonId?: string | null;
}): UserContext {
  const { uid, email, anonId } = args;
  const signedIn = Boolean(uid);
  return {
    userId: uid ?? anonId ?? "anon_unknown",
    ...(anonId ? { sessionId: anonId } : {}),
    ...(email ? { email } : {}),
    signedIn,
  };
}

/** Header the client sends its anonymous id in. */
export const ANON_ID_HEADER = "x-anon-id";

/**
 * Read the client's anonymous id from a request.
 *
 * Client-supplied and therefore untrusted — it is a grouping key for logs, not
 * an authorisation signal. Constrained in shape and length so a hostile client
 * can't inject huge or structured values into the log stream.
 */
export function readAnonId(req: Request): string | null {
  const raw = req.headers.get(ANON_ID_HEADER);
  if (!raw) return null;
  return /^anon_[A-Za-z0-9]{6,32}$/.test(raw) ? raw : null;
}

/** Normalise a thrown value into something loggable. */
export function errorData(err: unknown): LogData {
  if (err instanceof Error) {
    return { error: err.message, errorName: err.name, stack: err.stack };
  }
  return { error: String(err) };
}
