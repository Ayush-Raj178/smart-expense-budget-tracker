import { ArrowLeft, Landmark } from 'lucide-react';
import { Link } from 'react-router-dom';

const LegalDocument = ({ title, intro, sections }) => (
  <main className="min-h-screen bg-canvas px-5 py-8 text-text-primary sm:px-8 sm:py-12">
    <div className="mx-auto max-w-3xl">
      <nav className="mb-10 flex items-center justify-between gap-4">
        <Link to="/signup" className="inline-flex items-center gap-2 text-sm font-semibold text-text-secondary hover:text-text-primary"><ArrowLeft className="h-4 w-4 shrink-0" color="var(--muted-icon-hex)" />Back to signup</Link>
        <Link to="/login" className="flex items-center gap-2 text-sm font-bold"><span className="grid h-8 w-8 place-items-center rounded-md border border-border-strong bg-surface"><Landmark className="h-4 w-4 shrink-0" color="var(--accent-primary-hex)" /></span>SmartBudget</Link>
      </nav>
      <article className="rounded-xl border border-border-subtle bg-surface px-5 py-7 shadow-sm sm:px-10 sm:py-10">
        <header className="border-b border-border-subtle pb-7">
          <p className="text-xs font-semibold uppercase tracking-[0.1em] text-primary">SmartBudget legal</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">{title}</h1>
          <p className="mt-3 text-sm text-text-muted">Effective August 23, 2026</p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-text-secondary">{intro}</p>
        </header>
        <div className="space-y-8 pt-8">
          {sections.map(section => <section key={section.heading}><h2 className="text-lg font-semibold tracking-[-0.02em]">{section.heading}</h2><div className="mt-3 space-y-3 text-sm leading-7 text-text-secondary">{section.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div></section>)}
        </div>
      </article>
    </div>
  </main>
);

export default LegalDocument;
