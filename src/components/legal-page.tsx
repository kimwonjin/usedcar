import type { LegalDoc } from "@/content/legal";

export function LegalPage({ doc, draftNotice }: { doc: LegalDoc; draftNotice: string }) {
  return (
    <article className="flex flex-col gap-5 pb-8">
      <header className="flex flex-col gap-1">
        <h1 className="text-title font-bold text-navy">{doc.title}</h1>
        <p className="text-caption text-ink/60">{doc.updated}</p>
        <p className="rounded-lg bg-gold/15 px-3 py-2 text-caption text-ink/80">{draftNotice}</p>
      </header>
      <p className="text-body leading-relaxed">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading} className="flex flex-col gap-2">
          <h2 className="text-subtitle font-semibold">{section.heading}</h2>
          {section.body.map((paragraph) => (
            <p key={paragraph} className="text-body leading-relaxed text-ink/85">
              {paragraph}
            </p>
          ))}
        </section>
      ))}
    </article>
  );
}
