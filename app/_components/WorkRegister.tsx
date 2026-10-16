"use client";

import { useState } from "react";
import { work } from "../content";

export default function WorkRegister() {
  const [open, setOpen] = useState<number | null>(0);
  const years = work.map((w) => Number(w.year));

  return (
    <section id="work" className="mx-auto max-w-6xl scroll-mt-24 px-4 py-24 sm:px-8 md:py-32">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-5">
        <h2 className="text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Selected work</h2>
        <p className="text-muted">
          {work.length} projects, {Math.min(...years)}–{Math.max(...years)}
        </p>
      </div>

      <div className="hidden grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_4rem_2rem] gap-6 border-b border-rule py-3 text-sm text-muted md:grid">
        <span>Project</span>
        <span>What it is</span>
        <span>Year</span>
        <span className="sr-only">Toggle</span>
      </div>

      <ul>
        {work.map((w, i) => {
          const isOpen = open === i;
          const panelId = `work-panel-${i}`;
          return (
            <li key={w.title} className="border-b border-rule">
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => setOpen(isOpen ? null : i)}
                className="group grid w-full grid-cols-[minmax(0,1fr)_2rem] items-baseline gap-x-6 gap-y-1 py-5 text-left transition-colors hover:bg-surface/60 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_4rem_2rem] md:px-2"
              >
                <span className="min-w-0">
                  <span className="block text-xl font-semibold tracking-[-0.015em] md:text-2xl">{w.title}</span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {w.org}
                    {w.status ? `, ${w.status.toLowerCase()}` : ""}
                  </span>
                </span>
                <span className="col-start-1 row-start-2 text-[0.98rem] leading-snug text-ink/80 md:col-start-auto md:row-start-auto">
                  {w.summary}
                </span>
                <span className="hidden text-muted tabular-nums md:block">{w.year}</span>
                <span
                  aria-hidden="true"
                  className="col-start-2 row-start-1 flex h-8 w-8 items-center justify-center rounded-full border border-rule text-lg transition-[transform,border-color] duration-300 group-hover:border-ink md:col-start-auto md:row-start-auto"
                  style={{ transform: isOpen ? "rotate(45deg)" : "none" }}
                >
                  +
                </span>
              </button>

              <div id={panelId} className="row-panel" data-open={isOpen}>
                <div>
                  <div className="grid gap-6 pb-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1.6fr)_4rem_2rem] md:px-2">
                    <div className="flex flex-col items-start gap-4 md:order-2 md:col-span-1">
                      <ul className="space-y-2.5 text-[0.98rem] leading-relaxed text-ink/85">
                        {w.details.map((d) => (
                          <li key={d} className="relative pl-4 before:absolute before:left-0 before:top-[0.7em] before:h-1 before:w-1 before:rounded-full before:bg-signal">
                            {d}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="flex flex-col items-start gap-4 md:order-1">
                      <ul className="flex flex-wrap gap-1.5" aria-label="Tech used">
                        {w.stack.map((s) => (
                          <li key={s} className="rounded-md bg-surface px-2 py-1 text-sm text-ink/80">
                            {s}
                          </li>
                        ))}
                      </ul>
                      {w.link ? (
                        <a
                          href={w.link.href}
                          target="_blank"
                          rel="noopener"
                          className="text-[0.95rem] font-medium text-signal underline decoration-signal/30 underline-offset-4 hover:decoration-signal"
                        >
                          {w.link.label}
                        </a>
                      ) : (
                        <span className="text-sm text-muted">Private client work, no public link</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
