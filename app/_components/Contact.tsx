"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { profile } from "../content";
import { useReducedMotion } from "./useReducedMotion";

const ContactScene = dynamic(() => import("./scene/ContactScene"), { ssr: false });

export default function Contact() {
  const [copied, setCopied] = useState(false);
  const [inView, setInView] = useState(false);
  const slot = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();

  // Only start the second WebGL canvas once the section is near the viewport.
  useEffect(() => {
    const el = slot.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setInView(true), {
      rootMargin: "200px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${profile.email}`;
    }
  }

  return (
    <section id="contact" className="bg-ink text-surface">
      <div className="mx-auto grid max-w-6xl scroll-mt-16 items-center gap-10 px-4 py-24 sm:px-8 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] md:py-32">
        <div>
          <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Let&apos;s work together</h2>
          <p className="mt-4 max-w-[48ch] text-lg leading-relaxed text-surface/70">
            I&apos;m looking for remote fullstack or frontend roles. Email is the fastest way to reach me.
          </p>

          <a
            href={`mailto:${profile.email}`}
            className="mt-10 block break-all text-[clamp(1.5rem,3.4vw,3rem)] md:break-normal md:whitespace-nowrap font-semibold leading-tight tracking-[-0.03em] underline decoration-surface/25 underline-offset-[0.18em] transition-colors hover:decoration-surface"
          >
            {profile.email}
          </a>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={copyEmail}
              className="rounded-full bg-surface px-5 py-3 text-[0.95rem] font-medium text-ink transition-colors hover:bg-paper"
            >
              {copied ? "Email copied" : "Copy email"}
            </button>
            <a href={profile.linkedin} target="_blank" rel="noopener" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium transition-colors hover:border-surface">
              LinkedIn
            </a>
            <a href={profile.github} target="_blank" rel="noopener" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium transition-colors hover:border-surface">
              GitHub
            </a>
            <span aria-live="polite" className="sr-only">
              {copied ? "Email address copied to clipboard" : ""}
            </span>
          </div>
        </div>

        <div ref={slot} className="relative aspect-square w-full max-w-sm justify-self-center md:max-w-none" aria-hidden="true">
          {inView && <ContactScene reducedMotion={reduced} />}
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-wrap justify-between gap-2 border-t border-surface/15 px-4 py-6 text-sm text-surface/55 sm:px-8">
        <span>
          {profile.name}, {profile.location}
        </span>
        <span>Built with Next.js, Three.js, GLSL and GSAP</span>
      </div>
    </section>
  );
}
