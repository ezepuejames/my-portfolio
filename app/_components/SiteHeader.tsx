import { profile } from "../content";

const links = [
  { href: "#work", label: "Work" },
  { href: "#experience", label: "Experience" },
  { href: "#contact", label: "Contact" },
];

export default function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-rule/70 bg-paper/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <a href="#top" className="font-semibold tracking-[-0.01em]">
          {profile.name}
        </a>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="hidden rounded-full px-3 py-1.5 text-[0.95rem] text-muted transition-colors hover:text-ink sm:inline-block"
            >
              {l.label}
            </a>
          ))}
          <a
            href={profile.cv}
            target="_blank"
            rel="noopener"
            className="rounded-full border border-ink/25 px-4 py-1.5 text-[0.95rem] font-medium transition-colors hover:border-ink"
          >
            CV
          </a>
        </nav>
      </div>
    </header>
  );
}
