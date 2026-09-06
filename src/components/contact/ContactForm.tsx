"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Arrow } from "@/components/ui/Arrow";

type Status = "idle" | "sending" | "sent" | "error";

const MAX_MESSAGE = 4000;

/**
 * Every text input is `text-[16px] sm:text-[14px]`.
 *
 * NOT a style choice: Safari zooms the whole page in when a focused input has
 * type under 16px, and never zooms back out, which reads to the user as "the
 * site is the wrong width". Desktop cannot auto-zoom, so it keeps the smaller
 * type. See the gotcha in CLAUDE.md - this cost us the Snuffy chat's width on
 * iPhone, and it is invisible in Chrome's device emulation.
 */
const fieldClass =
  "w-full rounded-2xl border border-ss-hairline-strong bg-ss-panel px-[14px] py-[11px] " +
  "font-body text-[16px] sm:text-[14px] leading-[1.5] text-ss-ink " +
  "placeholder:text-ss-ink-faint focus:outline-none focus:border-ss-accent " +
  "disabled:opacity-60 transition-colors";

const labelClass = "block font-body text-[14px] font-medium text-ss-ink mb-[6px]";

export function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  /** Honeypot. Hidden from people; a bot that fills every field gives itself away. */
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  // Ids are generated rather than hardcoded so the labels stay correctly bound
  // if this form is ever rendered twice on one page.
  const uid = useId();
  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const messageId = `${uid}-message`;

  const sending = status === "sending";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (sending) return;

    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, message, website }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "The message could not be sent. Please try again in a moment.");
        setStatus("error");
        return;
      }
      setStatus("sent");
    } catch {
      setError("The message could not be sent. Please check your connection and try again.");
      setStatus("error");
    }
  }

  // The confirmation replaces the form rather than sitting above it: leaving a
  // filled-in form on screen invites a second, identical send.
  if (status === "sent") {
    // The page already wraps this in a panel, so the confirmation carries no
    // frame of its own - a card inside a card reads as a stray nested box.
    return (
      <div role="status" className="py-2 text-center">
        <div
          aria-hidden="true"
          className="w-10 h-10 mx-auto mb-3 rounded-full bg-ss-accent text-ss-on-accent inline-flex items-center justify-center"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path
              d="M3.5 9.5l3.5 3.5 7.5-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-head font-semibold text-[19px] leading-[1.25] tracking-[-0.015em] text-ss-ink m-0 mb-2">
          Thank you, your message is on its way
        </h2>
        <p className="text-[15px] leading-[1.55] text-ss-ink-soft m-0 max-w-[380px] mx-auto [text-wrap:pretty]">
          It has landed in the developer&rsquo;s inbox. You will get a reply at{" "}
          <span className="text-ss-ink">{email}</span>, usually within a few days.
        </p>
        <button
          type="button"
          onClick={() => {
            setName("");
            setEmail("");
            setMessage("");
            setStatus("idle");
          }}
          className="mt-4 border-none bg-transparent cursor-pointer font-body text-[14px] font-medium text-ss-accent-ink underline underline-offset-2 p-0"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4">
      <div>
        <label htmlFor={nameId} className={labelClass}>
          Name
        </label>
        <input
          id={nameId}
          name="name"
          type="text"
          autoComplete="name"
          required
          maxLength={120}
          disabled={sending}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={fieldClass}
          placeholder="What should we call you?"
        />
      </div>

      <div>
        <label htmlFor={emailId} className={labelClass}>
          Email address
        </label>
        <input
          id={emailId}
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          disabled={sending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={fieldClass}
          placeholder="So we can write back"
        />
      </div>

      <div>
        <label htmlFor={messageId} className={labelClass}>
          Your message
        </label>
        <textarea
          id={messageId}
          name="message"
          required
          rows={6}
          maxLength={MAX_MESSAGE}
          disabled={sending}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className={`${fieldClass} resize-y min-h-[130px]`}
          placeholder="A question, a bug, an idea, or something that did not work the way you expected."
        />
      </div>

      {/* Honeypot. `hidden` rather than an off-screen field, and aria-hidden +
          tabIndex so it is unreachable by keyboard and invisible to a screen
          reader - only a form-filling bot sees it. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        hidden
      />

      {error && (
        <p
          role="alert"
          className="m-0 text-[14px] leading-[1.5] text-caution-text bg-caution-bg rounded-xl px-[14px] py-[10px]"
        >
          {error}
        </p>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Button type="submit" disabled={sending}>
          {sending ? "Sending..." : <>Send <Arrow /></>}
        </Button>
        <span className="text-[13px] text-ss-ink-faint">
          Your address is used to reply, nothing else.
        </span>
      </div>
    </form>
  );
}
