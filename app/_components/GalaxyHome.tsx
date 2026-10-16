"use client";

import dynamic from "next/dynamic";
import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { education, experience, profile, skills, work } from "../content";
import { galaxy } from "./scene/space/galaxyState";
import { useReducedMotion } from "./useReducedMotion";

gsap.registerPlugin(useGSAP);

const GalaxyScene = dynamic(() => import("./scene/space/GalaxyScene"), { ssr: false });

type OverlayName = "projects" | "about" | "contact" | null;

/** A sheet that slides in from the right, used for Projects, About and Contact. */
function Sheet({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const el = useRef<HTMLDivElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const mounted = useRef(false);

  useGSAP(
    () => {
      if (!mounted.current) {
        // Start hidden off to the right without animating on page load.
        mounted.current = true;
        gsap.set(el.current, { xPercent: 105, autoAlpha: 0 });
        if (!open) return;
      }
      gsap.to(el.current, {
        xPercent: open ? 0 : 105,
        autoAlpha: open ? 1 : 0,
        duration: open ? 0.7 : 0.45,
        ease: open ? "expo.out" : "power3.in",
      });
      if (open) closeBtn.current?.focus({ preventScroll: true });
    },
    { dependencies: [open] }
  );

  return (
    <div
      ref={el}
      role="dialog"
      aria-modal="true"
      aria-label={title}
      data-sheet
      className="invisible fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-surface/10 bg-[#070c18]/92 text-surface backdrop-blur-xl md:w-[36rem]"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-surface/10 px-6">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          ref={closeBtn}
          type="button"
          onClick={onClose}
          className="rounded-full border border-surface/25 px-3 py-1.5 text-sm transition-colors hover:border-surface"
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-6 pb-12 pt-6">{children}</div>
    </div>
  );
}

export default function GalaxyHome() {
  const root = useRef<HTMLDivElement>(null);
  const hoverLabel = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(-1);
  const [overlay, setOverlay] = useState<OverlayName>(null);
  const [dragging, setDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const overlayRef = useRef<OverlayName>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    overlayRef.current = overlay;
  }, [overlay]);

  const closeProject = useCallback(() => {
    galaxy.focused = -1;
    setFocused(-1);
  }, []);

  const flyTo = useCallback((i: number) => {
    galaxy.focused = i;
    galaxy.hovered = -1;
    galaxy.onHover?.(-1);
    setOverlay(null);
    setFocused(i);
  }, []);

  // Wire the scene's callbacks to the DOM.
  useEffect(() => {
    galaxy.onHover = (i) => {
      const el = hoverLabel.current;
      if (!el) return;
      if (i >= 0 && galaxy.focused < 0) {
        el.textContent = `${work[i].title}, view project`;
        gsap.to(el, { opacity: 1, duration: 0.2 });
      } else {
        gsap.to(el, { opacity: 0, duration: 0.2 });
      }
    };
    galaxy.onSelect = (i) => flyTo(i);
    return () => {
      galaxy.onHover = galaxy.onSelect = null;
    };
  }, [flyTo, reduced]);

  // Navigation: wheel or swipe flies through depth, drag moves sideways, keys do both.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let id = -1;
    let lastX = 0;
    let lastY = 0;
    let pointerType = "mouse";
    const blocked = () => galaxy.focused >= 0 || overlayRef.current !== null;

    const wheel = (e: WheelEvent) => {
      if ((e.target as Element).closest("[data-sheet], [data-panel]")) return;
      e.preventDefault();
      if (blocked()) return;
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1;
      galaxy.targetTravel += gsap.utils.clamp(-20, 20, e.deltaY * unit * 0.05);
      galaxy.targetPanX -= gsap.utils.clamp(-4, 4, e.deltaX * unit * 0.01);
    };
    const down = (e: PointerEvent) => {
      if (blocked() || (e.target as Element).closest("a, button, [data-sheet], [data-panel]")) return;
      id = e.pointerId;
      pointerType = e.pointerType;
      lastX = e.clientX;
      lastY = e.clientY;
      galaxy.dragging = true;
      setDragging(true);
    };
    const move = (e: PointerEvent) => {
      if (hoverLabel.current) gsap.set(hoverLabel.current, { x: e.clientX + 18, y: e.clientY + 18 });
      if (!galaxy.dragging || e.pointerId !== id) return;
      const dx = e.clientX - lastX;
      const dy = e.clientY - lastY;
      lastX = e.clientX;
      lastY = e.clientY;
      const u = galaxy.unitsPerPixel;
      if (pointerType === "touch") {
        // On touch, swiping up flies forward and sideways swipes pan.
        galaxy.targetTravel -= dy * u * 4.5;
        galaxy.targetPanX += dx * u;
        galaxy.panVX = dx * u;
      } else {
        galaxy.targetPanX += dx * u;
        galaxy.targetPanY -= dy * u;
        galaxy.panVX = dx * u;
        galaxy.panVY = -dy * u;
      }
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      id = -1;
      galaxy.dragging = false;
      setDragging(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (overlayRef.current) setOverlay(null);
        else closeProject();
        return;
      }
      if (blocked() || (e.target as Element).closest("input, textarea")) return;
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") galaxy.targetTravel += 10;
      if (k === "arrowdown" || k === "s") galaxy.targetTravel -= 10;
      if (k === "arrowleft" || k === "a") galaxy.targetPanX += 2.5;
      if (k === "arrowright" || k === "d") galaxy.targetPanX -= 2.5;
    };

    el.addEventListener("wheel", wheel, { passive: false });
    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    window.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("wheel", wheel);
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      window.removeEventListener("keydown", key);
    };
  }, [closeProject]);

  // Opening entrance: fade the galaxy in while flying forward into it.
  useGSAP(
    () => {
      gsap.set(panel.current, { xPercent: 110, autoAlpha: 0 });
      if (reduced) {
        galaxy.intro = 1;
        galaxy.targetTravel = galaxy.travel = 30;
        return;
      }
      const tl = gsap.timeline();
      tl.to(galaxy, { intro: 1, duration: 2.4, ease: "power2.out" }, 0)
        .to(galaxy, { targetTravel: "+=30", duration: 3.2, ease: "power3.out" }, 0);
    },
    { scope: root, dependencies: [reduced] }
  );

  // Project details panel, and hide the intro while it is open.
  useGSAP(
    () => {
      const open = focused >= 0;
      gsap.to(panel.current, {
        xPercent: open ? 0 : 110,
        autoAlpha: open ? 1 : 0,
        duration: reduced ? 0 : open ? 0.7 : 0.4,
        ease: open ? "expo.out" : "power3.in",
        delay: open && !reduced ? 0.35 : 0,
      });
      if (open) panel.current?.focus({ preventScroll: true });
    },
    { scope: root, dependencies: [focused, reduced] }
  );

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(profile.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${profile.email}`;
    }
  }

  const project = focused >= 0 ? work[focused] : null;
  const navBtn = "rounded-full px-3 py-1.5 text-[0.95rem] text-surface/70 transition-colors hover:text-surface";

  return (
    <div
      ref={root}
      className={`fixed inset-0 touch-none select-none overflow-hidden bg-[#05080f] text-surface ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div className="absolute inset-0" aria-hidden="true">
        <GalaxyScene reducedMotion={reduced} eventSource={root} />
      </div>

      {/* Header */}
      <header className="absolute inset-x-0 top-0 z-30">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <button type="button" onClick={() => { setOverlay(null); closeProject(); }} className="font-semibold tracking-[-0.01em]">
            {profile.name}
          </button>
          <nav aria-label="Main" className="flex items-center gap-0.5 sm:gap-2">
            <button type="button" className={navBtn} onClick={() => setOverlay("projects")}>
              Projects
            </button>
            <button type="button" className={navBtn} onClick={() => setOverlay("about")}>
              About
            </button>
            <button type="button" className={`${navBtn} hidden sm:inline-block`} onClick={() => setOverlay("contact")}>
              Contact
            </button>
            <a
              href={profile.cv}
              target="_blank"
              rel="noopener"
              className="ml-1 rounded-full border border-surface/30 px-4 py-1.5 text-[0.95rem] font-medium transition-colors hover:border-surface"
            >
              CV
            </a>
          </nav>
        </div>
      </header>

      {/* The intro lives on asteroids in the scene; this copy is for screen readers and search. */}
      <div className="sr-only">
        <h1>{profile.headline.join(" ")}</h1>
        <p>{profile.intro}</p>
        <p>{profile.availability}</p>
      </div>

      {/* Project details after flying to a planet */}
      <aside
        ref={panel}
        data-panel
        tabIndex={-1}
        aria-label={project ? `${project.title} details` : undefined}
        className="absolute inset-x-3 bottom-3 z-20 max-h-[60svh] cursor-auto overflow-y-auto overscroll-contain rounded-2xl border border-surface/10 bg-[#0a1122]/88 p-6 backdrop-blur-md outline-none md:inset-x-auto md:bottom-auto md:right-8 md:top-24 md:max-h-[calc(100svh-8rem)] md:w-[27rem] md:p-8"
      >
        {project && (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-surface/60">
                  {project.org}, {project.year}
                  {project.status ? `, ${project.status.toLowerCase()}` : ""}
                </p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.025em]">{project.title}</h2>
              </div>
              <button
                type="button"
                onClick={closeProject}
                className="shrink-0 rounded-full border border-surface/25 px-3 py-1.5 text-sm transition-colors hover:border-surface"
              >
                Back to galaxy
              </button>
            </div>
            <p className="mt-4 leading-relaxed text-surface/85">{project.summary}</p>
            <ul className="mt-5 space-y-2.5 text-[0.95rem] leading-relaxed text-surface/75">
              {project.details.map((d) => (
                <li key={d} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-[#9cc2ff]">
                  {d}
                </li>
              ))}
            </ul>
            <ul className="mt-6 flex flex-wrap gap-1.5" aria-label="Tech used">
              {project.stack.map((s) => (
                <li key={s} className="rounded-md bg-surface/10 px-2 py-1 text-sm text-surface/80">
                  {s}
                </li>
              ))}
            </ul>
            <div className="mt-6">
              {project.link ? (
                <a
                  href={project.link.href}
                  target="_blank"
                  rel="noopener"
                  className="inline-block rounded-full bg-surface px-5 py-2.5 text-[0.95rem] font-medium text-ink transition-colors hover:bg-paper"
                >
                  {project.link.label}
                </a>
              ) : (
                <p className="text-sm text-surface/55">Private client work, no public link</p>
              )}
            </div>
          </>
        )}
      </aside>

      {/* Projects */}
      <Sheet open={overlay === "projects"} title="Projects" onClose={() => setOverlay(null)}>
        <p className="text-surface/65">Every planet in the galaxy, as a list. Choose one to fly there.</p>
        <ul className="mt-6">
          {work.map((w, i) => (
            <li key={w.title} className="border-t border-surface/10">
              <button
                type="button"
                onClick={() => flyTo(i)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 py-5 text-left"
              >
                <span className="text-xl font-semibold tracking-[-0.015em] transition-colors group-hover:text-[#9cc2ff]">
                  {w.title}
                </span>
                <span className="text-sm text-surface/55">{w.year}</span>
                <span className="col-span-2 text-[0.95rem] text-surface/70">{w.summary}</span>
                <span className="col-span-2 text-sm text-surface/45">{w.org}</span>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      {/* About */}
      <Sheet open={overlay === "about"} title="About" onClose={() => setOverlay(null)}>
        <p className="text-lg leading-relaxed text-surface/85">{profile.intro}</p>
        <h3 className="mt-10 text-sm text-surface/55">Experience</h3>
        <ol className="mt-2">
          {experience.map((e) => (
            <li key={e.org} className="border-t border-surface/10 py-5">
              <p className="text-sm text-surface/55">{e.period}</p>
              <p className="mt-1 text-lg font-semibold">{e.role}</p>
              <p className="text-surface/60">
                {e.org}, {e.place}
              </p>
              <p className="mt-2 leading-relaxed text-surface/75">{e.note}</p>
            </li>
          ))}
          <li className="border-t border-surface/10 py-5">
            <p className="text-sm text-surface/55">{education.period}</p>
            <p className="mt-1 text-lg font-semibold">{education.degree}</p>
            <p className="text-surface/60">{education.school}</p>
          </li>
        </ol>
        <h3 className="mt-8 text-sm text-surface/55">Tools</h3>
        <dl className="mt-2">
          {skills.map((s) => (
            <div key={s.group} className="border-t border-surface/10 py-4">
              <dt className="font-semibold">{s.group}</dt>
              <dd className="mt-1 text-surface/70">{s.items.join(", ")}</dd>
            </div>
          ))}
        </dl>
      </Sheet>

      {/* Contact */}
      <Sheet open={overlay === "contact"} title="Contact" onClose={() => setOverlay(null)}>
        <p className="text-lg leading-relaxed text-surface/80">
          I&apos;m looking for remote fullstack or frontend roles. Email is the fastest way to reach me.
        </p>
        <a
          href={`mailto:${profile.email}`}
          className="mt-8 block break-all text-[clamp(1.5rem,4vw,2.2rem)] font-semibold tracking-[-0.03em] underline decoration-surface/25 underline-offset-[0.18em] hover:decoration-surface"
        >
          {profile.email}
        </a>
        <div className="mt-8 flex flex-wrap gap-3">
          <button type="button" onClick={copyEmail} className="rounded-full bg-surface px-5 py-3 text-[0.95rem] font-medium text-ink hover:bg-paper">
            {copied ? "Email copied" : "Copy email"}
          </button>
          <a href={profile.linkedin} target="_blank" rel="noopener" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium hover:border-surface">
            LinkedIn
          </a>
          <a href={profile.github} target="_blank" rel="noopener" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium hover:border-surface">
            GitHub
          </a>
          <a href={profile.cv} target="_blank" rel="noopener" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium hover:border-surface">
            Download CV
          </a>
        </div>
        <span aria-live="polite" className="sr-only">
          {copied ? "Email address copied to clipboard" : ""}
        </span>
      </Sheet>

      <div
        ref={hoverLabel}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[90] rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink opacity-0"
      />
    </div>
  );
}
