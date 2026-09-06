import { NextResponse } from "next/server";
import { Resend } from "resend";
import { logger, flushLogs, errorData, readAnonId } from "@/lib/logger";

// The Resend SDK is a Node HTTP client, and the in-memory rate limiter below
// wants a warm instance to be worth anything.
export const runtime = "nodejs";

/** Where contact messages land. Set in the Vercel env, never hardcoded. */
const TO_EMAIL = process.env.CONTACT_TO_EMAIL;

/**
 * The From address. It MUST be on a domain verified in Resend, or the send
 * 403s - Resend's shared `onboarding@resend.dev` only delivers to the Resend
 * account owner's own address, which is not necessarily the inbox we want.
 */
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || "SealedSkin <contact@sealedskin.com>";

const MAX_NAME = 120;
const MAX_EMAIL = 254; // the RFC 5321 limit on a full address
const MAX_MESSAGE = 4000;

/**
 * Deliberately loose. Real address validity is decided by whether a reply
 * arrives, not by a regex, and the strict ones reject valid addresses. This
 * only catches a field that is obviously not an address at all.
 */
const EMAIL_RE = /^[^\s@]+@[^\s@.]+\.[^\s@]+$/;

/**
 * A crude per-instance rate limit: 3 messages per 10 minutes per IP.
 *
 * In-memory, so it resets when the serverless instance recycles and is not
 * shared between concurrent instances - it will not stop a determined attacker.
 * It is not meant to. It stops the ordinary case, a bot or a stuck retry loop
 * emptying the Resend quota into an inbox, and costs nothing. A real limiter
 * would need a shared store, which is not worth adding for a contact form.
 *
 * Checking and recording are SEPARATE on purpose. Counting every request would
 * mean three mistyped email addresses - which send nothing - lock a person out
 * for ten minutes. Only an actual send attempt (or a honeypot trip, which is a
 * bot) spends from the budget; a validation failure is free.
 */
const RATE_LIMIT = { max: 3, windowMs: 10 * 60 * 1000 };
const hits = new Map<string, number[]>();

function recentHits(ip: string, now: number): number[] {
  return (hits.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT.windowMs);
}

/** True when this IP has already used its budget. Records nothing. */
function rateLimited(ip: string): boolean {
  return recentHits(ip, Date.now()).length >= RATE_LIMIT.max;
}

/** Spend one from this IP's budget. Called only when we are about to send. */
function recordAttempt(ip: string): void {
  const now = Date.now();
  const recent = recentHits(ip, now);
  recent.push(now);
  hits.set(ip, recent);
  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 500) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= RATE_LIMIT.windowMs)) hits.delete(key);
    }
  }
}

function clientIp(req: Request): string {
  // Vercel sets x-forwarded-for; the client's address is the first entry.
  const fwd = req.headers.get("x-forwarded-for");
  return fwd?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

/** Escape for interpolation into the HTML body of the notification email. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Strip anything that could inject a second header if a value ever reaches a
 * header field (Subject, Reply-To). Resend sends over HTTPS rather than SMTP so
 * this is belt-and-braces, but the name and email are attacker-controlled and
 * both are used in header position.
 */
function headerSafe(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

interface ContactBody {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  /** Honeypot - see the POST handler. */
  website?: unknown;
}

/**
 * POST /api/contact
 * Body: { name, email, message, website? }
 * Returns: { ok: true } or { error: string }
 *
 * The response is deliberately vague about *why* a send failed, so the endpoint
 * cannot be used to probe the configuration.
 */
export async function POST(req: Request) {
  const anonId = readAnonId(req);
  const ip = clientIp(req);

  try {
    if (rateLimited(ip)) {
      logger.warn("contact.rateLimited", { anonId });
      return NextResponse.json(
        { error: "You have sent a few messages already. Please try again a little later." },
        { status: 429 },
      );
    }

    let body: ContactBody;
    try {
      body = (await req.json()) as ContactBody;
    } catch {
      return NextResponse.json({ error: "Could not read that request." }, { status: 400 });
    }

    /**
     * Honeypot: `website` is a real input in the form, hidden from people and
     * left empty. A bot that fills every field it finds gives itself away.
     * We answer 200 so the bot believes it succeeded and does not retry with a
     * different shape - but nothing is sent.
     */
    if (typeof body.website === "string" && body.website.trim() !== "") {
      recordAttempt(ip);
      logger.info("contact.honeypot", { anonId });
      return NextResponse.json({ ok: true });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name || !email || !message) {
      return NextResponse.json({ error: "Please fill in all three fields." }, { status: 400 });
    }
    if (name.length > MAX_NAME || email.length > MAX_EMAIL || message.length > MAX_MESSAGE) {
      return NextResponse.json({ error: "That message is too long to send." }, { status: 400 });
    }
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json(
        { error: "That email address does not look right. We need it to reply." },
        { status: 400 },
      );
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey || !TO_EMAIL) {
      // A configuration problem, not the visitor's fault - say so plainly and
      // log loudly, because from the outside this looks identical to a bug.
      logger.error("contact.notConfigured", {
        hasApiKey: Boolean(apiKey),
        hasToEmail: Boolean(TO_EMAIL),
      });
      return NextResponse.json(
        { error: "The contact form is not available right now. Please try again later." },
        { status: 503 },
      );
    }

    // Past validation and about to actually send: this one counts.
    recordAttempt(ip);

    const safeName = headerSafe(name);
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [TO_EMAIL],
      // So a reply in Gmail goes to the visitor rather than to the site.
      replyTo: `${safeName} <${headerSafe(email)}>`,
      subject: `SealedSkin contact: ${safeName}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      html:
        `<p><strong>From:</strong> ${escapeHtml(name)} ` +
        `&lt;${escapeHtml(email)}&gt;</p>` +
        `<hr>` +
        `<p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });

    if (error) {
      logger.error("contact.sendFailed", { anonId, resendError: error.message });
      return NextResponse.json(
        { error: "The message could not be sent. Please try again in a moment." },
        { status: 502 },
      );
    }

    logger.info("contact.sent", { anonId, messageLength: message.length });
    return NextResponse.json({ ok: true });
  } catch (err) {
    logger.error("contact.unexpected", { anonId, ...errorData(err) });
    return NextResponse.json(
      { error: "The message could not be sent. Please try again in a moment." },
      { status: 500 },
    );
  } finally {
    await flushLogs();
  }
}
