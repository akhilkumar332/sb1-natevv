type CmsCustomSection = {
  id: string;
  title?: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  enabled?: boolean;
  order?: number;
};

type ThemeToken = {
  accent?: 'red' | 'blue' | 'emerald' | 'amber';
  surface?: 'light' | 'soft' | 'contrast';
};

const toSafeHref = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^(javascript|data|vbscript):/i.test(trimmed)) return null;
  if (/^(https?:\/\/|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^\//.test(trimmed)) return trimmed;
  return null;
};

const getSections = (content: unknown): CmsCustomSection[] => {
  if (!content || typeof content !== 'object') return [];
  const raw = (content as Record<string, unknown>).customSections;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry) => Boolean(entry && typeof entry === 'object'))
    .map((entry) => {
      const section = entry as Record<string, unknown>;
      return {
        id: typeof section.id === 'string' ? section.id : '',
        title: typeof section.title === 'string' ? section.title : '',
        body: typeof section.body === 'string' ? section.body : '',
        ctaLabel: typeof section.ctaLabel === 'string' ? section.ctaLabel : '',
        ctaHref: typeof section.ctaHref === 'string' ? section.ctaHref : '',
        enabled: section.enabled !== false,
        order: Number.isFinite(section.order) ? Number(section.order) : 0,
      };
    })
    .filter((entry) => entry.id && entry.enabled)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
};

export default function CmsCustomSections({ content }: { content: unknown }) {
  const sections = getSections(content);
  if (!sections.length) return null;
  const theme = (content && typeof content === 'object' && !Array.isArray(content) && (content as Record<string, unknown>).theme && typeof (content as Record<string, unknown>).theme === 'object')
    ? ((content as Record<string, unknown>).theme as ThemeToken)
    : {};
  const accentClass = theme.accent === 'blue'
    ? 'border-blue-100 text-blue-700'
    : theme.accent === 'emerald'
      ? 'border-emerald-100 text-emerald-700'
      : theme.accent === 'amber'
        ? 'border-amber-100 text-amber-700'
        : 'border-red-100 text-red-700';
  const surfaceClass = theme.surface === 'contrast'
    ? 'bg-gray-50'
    : theme.surface === 'soft'
      ? 'bg-red-50/40'
      : 'bg-white';

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <div className="grid gap-4 md:grid-cols-2">
          {sections.map((section) => {
            const safeHref = toSafeHref(section.ctaHref);
            return (
              <article key={section.id} className={`rounded-2xl border p-6 shadow-sm ${accentClass} ${surfaceClass}`}>
                {section.title ? <h3 className="text-xl font-bold text-gray-900">{section.title}</h3> : null}
                {section.body ? <p className="mt-2 text-sm text-gray-700 whitespace-pre-line">{section.body}</p> : null}
                {section.ctaLabel && safeHref ? (
                  <a
                    href={safeHref}
                    target={safeHref.startsWith('http') ? '_blank' : undefined}
                    rel={safeHref.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="mt-4 inline-flex rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50"
                  >
                    {section.ctaLabel}
                  </a>
                ) : null}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
