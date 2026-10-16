import { education, experience, skills } from "../content";

export default function Experience() {
  return (
    <section id="experience" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-8 md:pb-32">
      <div className="grid gap-16 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] md:gap-20">
        <div>
          <h2 className="border-b border-ink pb-5 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Experience</h2>
          <ol className="mt-2">
            {experience.map((e) => (
              <li key={e.org} className="grid gap-1 border-b border-rule py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
                <span className="text-muted">{e.period}</span>
                <div>
                  <h3 className="text-xl font-semibold tracking-[-0.015em]">{e.role}</h3>
                  <p className="text-muted">
                    {e.org}, {e.place}
                  </p>
                  <p className="mt-3 max-w-[60ch] leading-relaxed text-ink/85">{e.note}</p>
                </div>
              </li>
            ))}
            <li className="grid gap-1 py-6 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-6">
              <span className="text-muted">{education.period}</span>
              <div>
                <h3 className="text-xl font-semibold tracking-[-0.015em]">{education.degree}</h3>
                <p className="text-muted">{education.school}</p>
              </div>
            </li>
          </ol>
        </div>

        <div>
          <h2 className="border-b border-ink pb-5 text-4xl font-semibold tracking-[-0.03em] md:text-5xl">Tools</h2>
          <dl className="mt-2">
            {skills.map((s) => (
              <div key={s.group} className="border-b border-rule py-6">
                <dt className="font-semibold">{s.group}</dt>
                <dd className="mt-2 leading-relaxed text-ink/80">{s.items.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
