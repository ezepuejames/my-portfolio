"use client";

import { useEffect, useState } from "react";
import { profile } from "../content";

const links = [
  { href: "#work", label: "Work" },
  { href: "#experience", label: "Experience" },
  { href: "#contact", label: "Contact" },
];

export default function SiteHeader() {
  // Switch to a dark header while it sits over the dark galaxy hero.
  const [overDark, setOverDark] = useState(true);

  useEffect(() => {
    const hero = document.querySelector("[data-dark]");
    if (!hero) return;
    const io = new IntersectionObserver(([entry]) => setOverDark(entry.isIntersecting), {
      rootMargin: "-64px 0px -100% 0px",
    });
    io.observe(hero);
    return () => io.disconnect();
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md transition-colors duration-300 ${
        overDark ? "border-surface/10 bg-[#060b16]/40 text-surface" : "border-rule/70 bg-paper/80 text-ink"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <a href="#top" className="font-semibold tracking-[-0.01em]">
          {profile.name}
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`hidden rounded-full px-3 py-1.5 text-[0.95rem] transition-colors sm:inline-block ${
                overDark ? "text-surface/65 hover:text-surface" : "text-muted hover:text-ink"
              }`}
            >
              {l.label}
            </a>
          ))}
          <a
            href={profile.cv}
            target="_blank"
            rel="noopener"
            className={`rounded-full border px-4 py-1.5 text-[0.95rem] font-medium transition-colors ${
              overDark ? "border-surface/30 hover:border-surface" : "border-ink/25 hover:border-ink"
            }`}
          >
            CV
          </a>
        </nav>
      </div>
    </header>
  );
}
