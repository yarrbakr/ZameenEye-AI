import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useAssistant, SUGGESTIONS } from "../../hooks/useAssistant";
import { useReducedMotion } from "../../hooks/useReducedMotion";
import type { MapAction } from "../../assistant/types";

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-4 3.5V16H5.5A1.5 1.5 0 0 1 4 14.5v-9Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1" fill="currentColor" />
      <circle cx="12.5" cy="10" r="1" fill="currentColor" />
      <circle cx="16" cy="10" r="1" fill="currentColor" />
    </svg>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-1.5" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-ink-dim"
          animate={{ opacity: [0.3, 1, 0.3] }}
          transition={{ duration: 1, repeat: Infinity, delay: i * 0.18 }}
        />
      ))}
    </div>
  );
}

function ActionChip({
  action,
  onRun,
}: {
  action: MapAction;
  onRun: (a: MapAction) => void;
}) {
  return (
    <button
      onClick={() => onRun(action)}
      className="focusable rounded-full border border-flood-blue/40 bg-flood-blue/15 px-2.5 py-1 font-display text-[11px] font-medium text-ink hover:bg-flood-blue/25"
    >
      {action.label}
    </button>
  );
}

export function AssistantWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const { messages, loading, send, execute } = useAssistant();
  const reducedMotion = useReducedMotion();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to the newest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit() {
    const t = input;
    setInput("");
    void send(t);
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  }

  const showSuggestions = messages.length <= 1;

  return (
    <>
      {/* Floating launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        className="focusable fixed bottom-6 right-6 z-50 flex items-center justify-center gap-2 rounded-full bg-flood-blue px-4 py-3 text-white shadow-lg shadow-black/40 transition-transform hover:scale-105"
      >
        <ChatIcon />
        <span className="hidden font-display text-sm font-semibold sm:inline">
          {open ? "Close" : "Ask ZameenEye"}
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="dialog"
            aria-label="ZameenEye assistant"
            initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed bottom-24 right-4 z-50 flex max-h-[70vh] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-panel-border bg-panel-solid/95 shadow-2xl shadow-black/60 backdrop-blur-xl sm:right-6"
          >
            {/* Header */}
            <div className="flex items-center gap-2 border-b border-panel-border px-4 py-3">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-flood-blue/90 text-white">
                <ChatIcon />
              </span>
              <div className="leading-tight">
                <div className="font-display text-sm font-bold tracking-wide">
                  ZameenEye Assistant
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-ink-dim">
                  Climate risk Q&amp;A
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="focusable ml-auto rounded p-1 text-ink-dim hover:text-ink"
              >
                ✕
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="panel-scroll flex-1 space-y-3 overflow-y-auto px-4 py-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-flood-blue/90 text-white"
                        : "rounded-bl-sm bg-white/5 text-ink"
                    }`}
                  >
                    <p className="whitespace-pre-line">{m.text}</p>
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {m.actions.map((a, i) => (
                          <ActionChip key={i} action={a} onRun={execute} />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-white/5">
                    <TypingDots />
                  </div>
                </div>
              )}
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="flex flex-wrap gap-1.5 px-4 pb-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    className="focusable rounded-full border border-panel-border bg-white/[0.03] px-2.5 py-1 text-[11px] text-ink-dim hover:text-ink"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex items-end gap-2 border-t border-panel-border p-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                placeholder="Ask about climate risk…"
                aria-label="Message the assistant"
                className="focusable max-h-24 flex-1 resize-none bg-transparent text-sm text-ink placeholder:text-ink-dim focus:outline-none"
              />
              <button
                onClick={submit}
                disabled={!input.trim() || loading}
                aria-label="Send"
                className="focusable rounded-lg bg-flood-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
              >
                ↑
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
