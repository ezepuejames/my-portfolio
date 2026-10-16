"use client";

import dynamic from "next/dynamic";
import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { profile } from "../content";
import { sceneState } from "./scene/store";
import { useReducedMotion } from "./useReducedMotion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const HeroScene = dynamic(() => import("./scene/HeroScene"), { ssr: false });

export default function Hero() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();

  useGSAP(
    () => {
      if (reduced) {
        sceneState.intro = 1;
        return;
      }

      // One orchestrated entrance: the headline rises line by line while the
      // camera settles onto the point field.
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });
      tl.from("[data-line]", { yPercent: 110, duration: 1.2, stagger: 0.09 })
        .from("[data-fade]", { opacity: 0, y: 12, duration: 0.8, stagger: 0.06 }, "-=0.7")
        .to(sceneState, { intro: 1, duration: 2.2, ease: "power3.out" }, 0)
        .from("[data-canvas]", { opacity: 0, duration: 1.6, ease: "power2.out" }, 0);

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

  return (
    <section ref={root} id="top" className="relative isolate min-h-[100svh] overflow-hidden">
      <div data-canvas className="absolute inset-0 -z-10" aria-hidden="true">
        <HeroScene reducedMotion={reduced} />
      </div>

      <div className="mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-start px-4 pb-16 pt-28 sm:px-8 md:pt-36">
        <h1 className="text-[clamp(2.15rem,6.4vw,5.4rem)] font-semibold leading-[0.98] tracking-[-0.035em]">
          {profile.headline.map((line) => (
            <span key={line} className="block overflow-hidden pb-[0.06em]">
              <span data-line className="block md:whitespace-nowrap">
                {line}
              </span>
            </span>
          ))}
        </h1>

        <p data-fade className="mt-8 max-w-[52ch] text-lg leading-relaxed text-muted md:text-xl">
          {profile.intro}
        </p>

        <p data-fade className="mt-6 flex items-center gap-2.5 text-[0.95rem] text-ink">
          <span className="relative inline-flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-live opacity-50 motion-reduce:hidden" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-live" />
          </span>
          {profile.availability}
        </p>

        <div data-fade className="mt-8 flex flex-wrap gap-3">
          <a
            href={profile.cv}
            target="_blank"
            rel="noopener"
            className="rounded-full bg-ink px-5 py-3 text-[0.95rem] font-medium text-surface transition-colors hover:bg-signal"
          >
            Download CV
          </a>
          <a
            href="#work"
            className="rounded-full border border-ink/25 bg-surface/70 px-5 py-3 text-[0.95rem] font-medium backdrop-blur transition-colors hover:border-ink"
          >
            See my work
          </a>
        </div>
      </div>
    </section>
  );
}
