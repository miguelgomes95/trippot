"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export const SECTIONS = [
  { id: "problem", label: "The problem" },
  { id: "how", label: "How it works" },
  { id: "try", label: "Try the split" },
  { id: "agent", label: "The agent" },
  { id: "under-the-hood", label: "Under the hood" },
  { id: "faq", label: "Questions" },
];

/** Sticky header with the page's sections, the one in view, and how far down the page you are. */
export function LandingNav() {
  const [active, setActive] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setProgress(max > 0 ? window.scrollY / max : 0);
      setScrolled(window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id);
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    }
    return () => {
      window.removeEventListener("scroll", onScroll);
      io.disconnect();
    };
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-200 ${
        scrolled ? "border-b border-line bg-paper/90 backdrop-blur" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-3.5 sm:px-10">
        <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
          <JarMark />
          TripPot
        </Link>
        <nav aria-label="Sections" className="hidden lg:block">
          <ul className="flex gap-1 text-sm">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  aria-current={active === s.id ? "true" : undefined}
                  className={`rounded-md px-2.5 py-1.5 hover:text-ink ${
                    active === s.id ? "bg-surface font-medium text-ink" : "text-muted"
                  }`}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/example" className="shrink-0 rounded-lg bg-ink px-3.5 py-2 text-sm font-medium text-white hover:bg-ink/85">
          Open the example trip
        </Link>
      </div>
      <div aria-hidden className="h-0.5 origin-left bg-saffron" style={{ transform: `scaleX(${progress})` }} />
    </header>
  );
}

function JarMark() {
  return (
    <svg viewBox="0 0 20 24" className="h-6 w-5" aria-hidden>
      <rect x="2" y="1" width="16" height="3.5" rx="1.2" fill="var(--color-ink)" />
      <path d="M4 6h12a2 2 0 0 1 2 2v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8a2 2 0 0 1 2-2Z" fill="var(--color-surface)" stroke="var(--color-ink)" strokeWidth="1.6" />
      <path d="M2.8 14h14.4v6a2.2 2.2 0 0 1-2.2 2.2H5A2.2 2.2 0 0 1 2.8 20Z" fill="var(--color-saffron)" />
    </svg>
  );
}
