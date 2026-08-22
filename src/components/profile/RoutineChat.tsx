"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCurrentIdToken } from "../../lib/firebase/client";
import { anonHeaders } from "../../lib/anonId";
import type { RoutineChatMessage } from "../../lib/domain/types";
import type { GroundingInfo } from "../../lib/ai/types";
import { GroundingSources } from "../results/GroundingSources";

/** Mirrors `MAX_CHAT_MESSAGE_CHARS` on the server, so the UI stops you first. */
const MAX_CHARS = 1000;

/**
 * Openers offered on an empty conversation. They exist to show the scope: this
 * assistant talks about YOUR routine, not skincare in general.
 */
const STARTERS = [
  "Is the order of my steps right?",
  "Which of my picks is best reviewed?",
  "Can I swap my moisturiser for something else?",
];

interface Props {
  /** The saved routine being discussed. */
  quizId: string;
  /** Card title, e.g. "Combination skin". */
  title: string;
  /** Card accent detail, e.g. "Balanced". */
  subtitle?: string | null;
  onClose: () => void;
}

/** A locally-added message that has no server id yet. */
type Message = RoutineChatMessage;

/**
 * Render the assistant's reply. The prompts keep the copy plain (no markdown),
 * but models still reach for "- " bullets, so those become a real list and
 * everything else becomes paragraphs. Deliberately not a markdown renderer:
 * that would be a dependency and an injection surface for one formatting habit.
 */
function ReplyBody({ text }: { text: string }) {
  const blocks: { bullets?: string[]; text?: string }[] = [];
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line) continue;
    const bullet = line.match(/^[-*•]\s+(.*)$/);
    const last = blocks[blocks.length - 1];
    if (bullet) {
      if (last?.bullets) last.bullets.push(bullet[1]);
      else blocks.push({ bullets: [bullet[1]] });
    } else if (last?.text !== undefined) {
      last.text += ` ${line}`;
    } else {
      blocks.push({ text: line });
    }
  }

  return (
    <>
      {blocks.map((b, i) =>
        b.bullets ? (
          <ul key={i} className="list-none m-0 p-0 grid gap-1">
            {b.bullets.map((item, j) => (
              <li key={j} className="pl-[14px] relative before:content-['·'] before:absolute before:left-0 before:text-ss-accent-ink">
                {item}
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="m-0">
            {b.text}
          </p>
        ),
      )}
    </>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex items-center gap-[5px] py-1" aria-label="Thinking">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[6px] h-[6px] rounded-full bg-ss-ink-faint animate-pulse"
          style={{ animationDelay: `${i * 160}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * The "Discuss with AI" window: a modal conversation about one saved routine.
 *
 * The routine itself is never sent from here - the server reads it from the
 * caller's own Firestore record by `quizId`, so all this component posts is a
 * question. History is persisted server-side, so reopening resumes.
 */
export function RoutineChat({ quizId, title, subtitle, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // Close on Escape, and lock the page behind the dialog from scrolling.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  // Load any stored conversation. Defers every setState past an await, so it is
  // safe to call straight from an effect (see the note in ProfileView).
  const loadHistory = useCallback(async () => {
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) return;
      const res = await fetch(`/api/routine-chat?quizId=${encodeURIComponent(quizId)}`, {
        headers: { Authorization: `Bearer ${idToken}`, ...anonHeaders() },
      });
      if (res.ok) {
        const body = (await res.json()) as { messages?: Message[] };
        setMessages(body.messages ?? []);
      }
    } catch {
      // A failed history read is not worth an error panel - the user can still
      // ask a question, they just start from an empty window.
    } finally {
      setLoadingHistory(false);
    }
  }, [quizId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- external sync; `loadHistory` awaits before any setState
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Keep the newest turn in view as the conversation grows.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: messages.length ? "smooth" : "auto" });
  }, [messages, sending]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || sending) return;
    setInput("");
    setError(null);
    setSending(true);
    // Show the question straight away; the server stores both turns once the
    // reply lands, so this local id is only ever a React key.
    setMessages((m) => [
      ...m,
      { id: `local-${m.length}`, role: "user", text, createdAt: Date.now() },
    ]);
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) throw new Error("Please sign in again");
      const res = await fetch("/api/routine-chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
          ...anonHeaders(),
        },
        body: JSON.stringify({ quizId, message: text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Something went wrong (${res.status})`);
      }
      const body = (await res.json()) as { reply: Message };
      setMessages((m) => [...m, body.reply]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that");
      // Put the question back in the box so it isn't lost.
      setInput(text);
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
    }
  }

  async function handleClear() {
    if (!messages.length || clearing) return;
    setClearing(true);
    setError(null);
    try {
      const idToken = await getCurrentIdToken();
      if (!idToken) throw new Error("Please sign in again");
      const res = await fetch(`/api/routine-chat?quizId=${encodeURIComponent(quizId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${idToken}`, ...anonHeaders() },
      });
      if (!res.ok) throw new Error("Couldn't clear this conversation");
      setMessages([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't clear this conversation");
    } finally {
      setClearing(false);
    }
  }

  const empty = !loadingHistory && messages.length === 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/*
        A scrim is one of the few things that must NOT follow the palette: the
        `ss-ink` token inverts to a light colour in dark mode, which brightened
        the page behind the dialog instead of dimming it. Black in both themes.
      */}
      <div
        className="absolute inset-0 bg-black/45 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Discuss your ${title} routine with an AI consultant`}
        className="relative w-full sm:max-w-[560px] h-[88vh] sm:h-[min(660px,86vh)] flex flex-col overflow-hidden bg-ss-panel border border-ss-hairline rounded-t-2xl sm:rounded-2xl shadow-[0_24px_60px_-24px_rgba(0,0,0,0.35)]"
      >
        {/* Header */}
        <div className="shrink-0 flex items-start gap-3 px-[18px] py-[14px] border-b border-ss-hairline bg-ss-surface">
          <span className="shrink-0 mt-[2px] w-9 h-9 rounded-full bg-ss-accent-tint text-ss-accent-ink inline-flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 20.5l1.6-4.1a8.4 8.4 0 0 1-.9-3.9 8.4 8.4 0 0 1 8.4-8.4 8.4 8.4 0 0 1 8.9 7.4z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <h2 className="font-head font-semibold text-[16px] leading-[1.2] tracking-[-0.01em] text-ss-ink m-0">
              Your skincare consultant
            </h2>
            <p className="text-[12.5px] leading-[1.4] text-ss-ink-soft m-0 mt-[2px] truncate">
              {title}
              {subtitle && <span className="text-ss-accent-ink"> · {subtitle}</span>}
            </p>
          </div>
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => void handleClear()}
              disabled={clearing}
              className="shrink-0 font-mono text-[11px] text-ss-ink-faint hover:text-ss-accent-ink underline underline-offset-2 bg-transparent border-none cursor-pointer disabled:opacity-50 mt-[6px]"
            >
              {clearing ? "Clearing…" : "Clear chat"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="shrink-0 w-8 h-8 rounded-full inline-flex items-center justify-center bg-transparent border-none text-ss-ink-faint hover:text-ss-ink hover:bg-ss-accent-tint transition-colors cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Conversation */}
        <div className="flex-1 min-h-0 overflow-y-auto px-[18px] py-4 grid content-start gap-3">
          {empty && (
            <div className="py-2">
              <p className="text-[14.5px] leading-[1.55] text-ss-ink m-0 mb-1 [text-wrap:pretty]">
                Hi - I have your {title.toLowerCase()} routine in front of me.
              </p>
              <p className="text-[13.5px] leading-[1.55] text-ss-ink-soft m-0 mb-4 [text-wrap:pretty]">
                Ask me anything about it: the steps, the products, how often to use something, or
                what to swap if it isn&rsquo;t working. I look up current reviews and ratings before
                I recommend anything.
              </p>
              <div className="grid gap-2 justify-items-start">
                {STARTERS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void send(s)}
                    className="text-left px-[14px] py-[9px] rounded-full border border-ss-hairline-strong bg-ss-surface text-ss-ink-soft font-body text-[13px] cursor-pointer hover:border-ss-accent hover:text-ss-accent-ink transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="justify-self-end max-w-[85%] rounded-2xl rounded-br-md bg-ss-accent text-ss-on-accent px-[14px] py-[10px] text-[14px] leading-[1.5] whitespace-pre-wrap">
                {m.text}
              </div>
            ) : (
              <div key={m.id} className="max-w-[92%] rounded-2xl rounded-bl-md bg-ss-surface border border-ss-hairline px-[14px] py-[11px]">
                <div className="grid gap-2 text-[14px] leading-[1.55] text-ss-ink [text-wrap:pretty]">
                  <ReplyBody text={m.text} />
                </div>
                {m.grounding ? <GroundingSources grounding={m.grounding as GroundingInfo} /> : null}
              </div>
            ),
          )}

          {sending && (
            <div className="max-w-[92%] rounded-2xl rounded-bl-md bg-ss-surface border border-ss-hairline px-[14px] py-[11px]">
              <TypingDots />
              <p className="text-[12px] text-ss-ink-faint m-0 mt-1">Checking current reviews…</p>
            </div>
          )}

          {error && (
            <p className="text-[13px] text-caution-text m-0">{error} - please try again.</p>
          )}

          <div ref={endRef} />
        </div>

        {/* Composer */}
        <div className="shrink-0 border-t border-ss-hairline bg-ss-surface px-[18px] py-3">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value.slice(0, MAX_CHARS))}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              rows={1}
              placeholder="Ask about your routine..."
              disabled={sending}
              className="flex-1 min-w-0 resize-none max-h-[120px] rounded-2xl border border-ss-hairline-strong bg-ss-panel px-[14px] py-[10px] font-body text-[14px] leading-[1.5] text-ss-ink placeholder:text-ss-ink-faint focus:outline-none focus:border-ss-accent disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void send(input)}
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="shrink-0 w-10 h-10 rounded-full inline-flex items-center justify-center bg-ss-accent text-ss-on-accent border-none cursor-pointer transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h13M12 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <p className="text-[11px] leading-[1.4] text-ss-ink-faint m-0 mt-2 [text-wrap:pretty]">
            General guidance about your routine, not medical advice. See a dermatologist for
            anything persistent.
          </p>
        </div>
      </div>
    </div>
  );
}
