"use client";

import { useRef, useState, useTransition } from "react";
import { askAgent, type ChatTurn } from "@/app/trips/[id]/actions";

const SUGGESTIONS = [
  "Who still owes money?",
  "Remind everyone who is late",
  "Which supplier do we pay next?",
];

export function AgentChat({ tripId, tripName }: { tripId: string; tripName: string }) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  function send(text: string) {
    const question = text.trim();
    if (!question || pending) return;
    const history = turns;
    setTurns([...history, { role: "user", text: question }]);
    setDraft("");
    setError(null);
    startTransition(async () => {
      try {
        const { answer } = await askAgent(tripId, question, history);
        setTurns((t) => [...t, { role: "assistant", text: answer || "Done." }]);
      } catch {
        setError("The agent couldn't answer. Check the server logs and try again.");
      }
      requestAnimationFrame(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }));
    });
  }

  return (
    <section aria-labelledby="agent-title" className="flex h-full flex-col">
      <header className="border-b border-line px-5 py-4">
        <h2 id="agent-title" className="font-display text-lg font-semibold">
          Ask TripPot
        </h2>
        <p className="text-sm text-muted">It reads the pot, reminds travellers and pays suppliers for {tripName}.</p>
      </header>

      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4" aria-live="polite">
        {turns.length === 0 && (
          <div className="space-y-2">
            <p className="text-sm text-muted">Try asking:</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-lg border border-line bg-paper px-3 py-2 text-left text-sm hover:border-ink"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {turns.map((t, i) => (
          <p
            key={i}
            className={
              t.role === "user"
                ? "ml-8 rounded-2xl rounded-br-sm bg-ink px-4 py-2.5 text-sm text-white"
                : "mr-4 whitespace-pre-wrap text-sm leading-relaxed"
            }
          >
            {t.text}
          </p>
        ))}
        {pending && <p className="text-sm text-muted">Checking the pot…</p>}
        {error && <p className="text-sm text-brick">{error}</p>}
        <div ref={endRef} />
      </div>

      <form
        className="border-t border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
      >
        <label htmlFor="agent-input" className="sr-only">
          Message TripPot
        </label>
        <div className="flex gap-2">
          <input
            id="agent-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask about payments or tell it what to do"
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-ink"
            disabled={pending}
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </section>
  );
}
