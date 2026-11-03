"use client";

import { useInView } from "./use-in-view";

// The problem, as every trip organizer has lived it: the group chat before the deadline.
const MESSAGES: { from: string; text: string; me?: boolean; color?: string }[] = [
  { from: "Miguel", me: true, text: "Riad deposit is due 1 March: €864. I'll pay it, so everyone send me €72 👍" },
  { from: "Ana", color: "text-violet", text: "I'm skipping the desert tour, do I still pay for that?" },
  { from: "Rui", color: "text-teal", text: "how much was the single room again" },
  { from: "Joana", color: "text-brick", text: "Sent! 💸" },
  { from: "Tiago", color: "text-violet", text: "will pay after payday 🙏" },
  { from: "Pedro", color: "text-teal", text: "what's your IBAN?" },
  { from: "Miguel", me: true, text: "Still waiting on 7 of you. The €2,016 balance is due 15 April 😬" },
];

export function GroupChat() {
  const [ref, seen] = useInView<HTMLDivElement>(0.5);
  return (
    <div
      ref={ref}
      className={`reveal ${seen ? "reveal-on" : ""} mx-auto w-full max-w-[22rem] rounded-[2rem] border-[6px] border-ink bg-[#e6e9ef] p-3 shadow-[0_30px_60px_-30px_rgba(24,32,46,0.45)]`}
      aria-label="A group chat about paying for the trip"
      role="img"
    >
      <div className="rounded-t-[1.4rem] bg-surface px-4 py-3">
        <p className="font-semibold">Marrakech May 2027 🌴</p>
        <p className="text-xs text-muted">12 people</p>
      </div>
      <ol className="space-y-2 px-1 pt-3 pb-2 text-[14px] leading-snug" aria-hidden>
        {MESSAGES.map((m, i) => (
          <li
            key={i}
            className={`chat-in flex ${m.me ? "justify-end" : "justify-start"}`}
            style={{ animationDelay: `${0.2 + i * 0.55}s` }}
          >
            <span
              className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                m.me ? "rounded-br-md bg-saffron-soft" : "rounded-bl-md bg-surface"
              }`}
            >
              {!m.me && <span className={`block text-xs font-semibold ${m.color}`}>{m.from}</span>}
              {m.text}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
