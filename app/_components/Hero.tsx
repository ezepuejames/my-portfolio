"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { profile, work } from "../content";
import { sceneState } from "./scene/store";
import { galaxy } from "./scene/space/galaxyState";
import { useReducedMotion } from "./useReducedMotion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const GalaxyScene = dynamic(() => import("./scene/space/GalaxyScene"), { ssr: false });

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const nearestTitle = useRef<HTMLParagraphElement>(null);
  const nearestMeta = useRef<HTMLParagraphElement>(null);
  const hoverLabel = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLElement>(null);
  const [focused, setFocused] = useState(-1);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();

  const close = useCallback(() => {
    galaxy.focused = -1;
    setFocused(-1);
  }, []);

  // Wire the scene's callbacks to the DOM overlays.
  useEffect(() => {
    galaxy.onNearest = (i) => {
      const w = work[i];
      if (!w || !nearestTitle.current || !nearestMeta.current) return;
      nearestTitle.current.textContent = w.title;
      nearestMeta.current.textContent = `${w.org}, ${w.year}`;
      if (!reduced) gsap.fromTo(nearestTitle.current, { yPercent: 40, opacity: 0 }, { yPercent: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
    };
    galaxy.onHover = (i) => {
      const el = hoverLabel.current;
      if (!el) return;
      if (i >= 0 && galaxy.focused < 0) {
        el.textContent = `${work[i].title}, view details`;
        gsap.to(el, { opacity: 1, duration: 0.2 });
      } else {
        gsap.to(el, { opacity: 0, duration: 0.2 });
      }
    };
    galaxy.onSelect = (i) => {
      galaxy.focused = i;
      galaxy.hovered = -1;
      galaxy.onHover?.(-1);
      setFocused(i);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => {
      galaxy.onNearest = galaxy.onHover = galaxy.onSelect = null;
      window.removeEventListener("keydown", onKey);
    };
  }, [close, reduced]);

  // Drag anywhere in the hero to pan the galaxy; it keeps gliding after release.
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    let lastX = 0;
    let lastY = 0;
    let id = -1;

    const down = (e: PointerEvent) => {
      if (galaxy.focused >= 0) return;
      if ((e.target as Element).closest("a, button, [data-panel]")) return;
      id = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      galaxy.dragging = true;
      setDragging(true);
    };
    const move = (e: PointerEvent) => {
      if (hoverLabel.current) gsap.set(hoverLabel.current, { x: e.clientX + 18, y: e.clientY + 18 });
      if (!galaxy.dragging || e.pointerId !== id) return;
      const dx = (e.clientX - lastX) * galaxy.unitsPerPixel;
      const dy = (e.clientY - lastY) * galaxy.unitsPerPixel;
      lastX = e.clientX;
      lastY = e.clientY;
      galaxy.targetX += dx;
      galaxy.targetY -= dy;
      galaxy.vx = dx;
      galaxy.vy = -dy;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== id) return;
      galaxy.dragging = false;
      id = -1;
      setDragging(false);
    };
    const enter = () => (sceneState.pointerActive = true);
    const leave = () => (sceneState.pointerActive = false);

    el.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    el.addEventListener("pointerenter", enter);
    el.addEventListener("pointerleave", leave);
    return () => {
      el.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      el.removeEventListener("pointerenter", enter);
      el.removeEventListener("pointerleave", leave);
    };
  }, []);

  // Slide the details panel in and out.
  useGSAP(
    () => {
      if (!panel.current) return;
      gsap.to(panel.current, {
        xPercent: focused >= 0 ? 0 : 110,
        opacity: focused >= 0 ? 1 : 0,
        duration: reduced ? 0 : 0.7,
        ease: focused >= 0 ? "expo.out" : "power3.in",
        delay: focused >= 0 && !reduced ? 0.25 : 0,
      });
      gsap.to("[data-intro]", { opacity: focused >= 0 ? 0 : 1, duration: 0.4, pointerEvents: focused >= 0 ? "none" : "auto" });
      if (focused >= 0) panel.current.focus({ preventScroll: true });
    },
    { scope: root, dependencies: [focused, reduced] }
  );

  // One orchestrated entrance, then scroll pulls the camera back.
  useGSAP(
    () => {
      gsap.set(panel.current, { xPercent: 110, opacity: 0 });
      if (reduced) {
        sceneState.intro = 1;
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.to(sceneState, { intro: 1, duration: 2.6, ease: "power3.out" }, 0)
        .from("[data-line]", { yPercent: 110, duration: 1.2, stagger: 0.08 }, 0.3)
        .from("[data-fade]", { opacity: 0, y: 12, duration: 0.8, stagger: 0.06 }, 0.9);

      ScrollTrigger.create({
        trigger: root.current,
        start: "top top",
        end: "bottom top",
        scrub: 0.6,
        onUpdate: (self) => {
          sceneState.scroll = self.progress;
        },
      });
    },
    { scope: root, dependencies: [reduced] }
  );

  const project = focused >= 0 ? work[focused] : null;

  return (
    <section
      ref={root}
      id="top"
      data-dark
      className={`relative isolate h-[100svh] min-h-[560px] touch-pan-y select-none overflow-hidden bg-[#060b16] text-surface ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
    >
      <div className="absolute inset-0 -z-10" aria-hidden="true">
        <GalaxyScene reducedMotion={reduced} eventSource={root} />
      </div>
      {/* Keeps the intro text readable over the planets drifting behind it. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-[5] bg-[radial-gradient(ellipse_at_15%_45%,rgba(6,11,22,0.85),rgba(6,11,22,0.2)_55%,transparent_75%)]"
      />

      <div data-intro className="pointer-events-none mx-auto flex h-full max-w-6xl flex-col justify-between px-4 pb-8 pt-24 sm:px-8 md:pt-32">
        <div className="max-w-xl">
          <h1 className="text-[clamp(2rem,4.4vw,3.8rem)] font-semibold leading-[1.02] tracking-[-0.035em]">
            {profile.headline.map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.06em]">
                <span data-line className="block">
                  {line}
                </span>
              </span>
            ))}
          </h1>
          <p data-fade className="mt-6 max-w-[46ch] leading-relaxed text-surface/70 md:text-lg">
            {profile.intro}
          </p>
          <p data-fade className="mt-5 flex items-center gap-2.5 text-[0.95rem]">
            <span className="relative inline-flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#3ccf96] opacity-50 motion-reduce:hidden" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#3ccf96]" />
            </span>
            {profile.availability}
          </p>
          <div data-fade className="pointer-events-auto mt-7 flex flex-wrap gap-3">
            <a href={profile.cv} target="_blank" rel="noopener" className="rounded-full bg-surface px-5 py-3 text-[0.95rem] font-medium text-ink transition-colors hover:bg-paper">
              Download CV
            </a>
            <a href="#work" className="rounded-full border border-surface/30 px-5 py-3 text-[0.95rem] font-medium transition-colors hover:border-surface">
              See all work as a list
            </a>
          </div>
        </div>

        <div data-fade className="flex items-end justify-between gap-6">
          <p className="max-w-[22ch] text-sm text-surface/60">
            Drag to explore. Each planet is a project; click one to see what I built.
          </p>
          <div className="text-right" aria-live="polite">
            <p ref={nearestTitle} className="text-2xl font-semibold tracking-[-0.02em] md:text-3xl" />
            <p ref={nearestMeta} className="mt-1 text-sm text-surface/60" />
          </div>
        </div>
      </div>

      {/* Project details, shown after flying to a planet. */}
      <aside
        ref={panel}
        data-panel
        tabIndex={-1}
        aria-hidden={focused < 0}
        aria-label={project ? `${project.title} details` : undefined}
        className="absolute inset-x-3 bottom-3 z-10 max-h-[62svh] cursor-auto overflow-y-auto rounded-2xl border border-surface/10 bg-[#0b1324]/85 p-6 backdrop-blur-md outline-none md:inset-x-auto md:bottom-auto md:right-8 md:top-28 md:max-h-[calc(100svh-9rem)] md:w-[26rem] md:p-8"
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
                onClick={close}
                className="shrink-0 rounded-full border border-surface/25 px-3 py-1.5 text-sm transition-colors hover:border-surface"
              >
                Close
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

      <div
        ref={hoverLabel}
        aria-hidden="true"
        className="pointer-events-none fixed left-0 top-0 z-[90] rounded-full bg-surface px-3 py-1 text-sm font-medium text-ink opacity-0"
      />
    </section>
  );
}
