type AuditInput = {
  title?: string | null;
  seoTitle?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  seoDescription?: string | null;
  contentJson?: string | null;
  coverImageUrl?: string | null;
  ogImageUrl?: string | null;
};

export type SeoAuditResult = {
  score: number;
  checks: Array<{ id: string; label: string; passed: boolean }>;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getBlocksText = (contentJson?: string | null): string => {
  if (!contentJson) return '';
  try {
    const parsed = JSON.parse(contentJson) as { blocks?: Array<{ text?: string }> };
    if (!Array.isArray(parsed.blocks)) return contentJson;
    return parsed.blocks.map((b) => (typeof b?.text === 'string' ? b.text : '')).join(' ').trim();
  } catch {
    return contentJson;
  }
};

export const runSeoAudit = (input: AuditInput): SeoAuditResult => {
  const resolvedTitle = (input.seoTitle || input.title || '').trim();
  const resolvedDescription = (input.seoDescription || input.excerpt || '').trim();
  const bodyText = getBlocksText(input.contentJson);
  const firstWord = resolvedTitle.split(/\s+/)[0]?.toLowerCase() || '';

  const checks = [
    {
      id: 'title-length',
      label: 'SEO title length (30-70 chars)',
      passed: resolvedTitle.length >= 30 && resolvedTitle.length <= 70,
    },
    {
      id: 'description-length',
      label: 'Meta description length (70-180 chars)',
      passed: resolvedDescription.length >= 70 && resolvedDescription.length <= 180,
    },
    {
      id: 'slug-quality',
      label: 'Readable slug (3+ chars)',
      passed: Boolean(input.slug && input.slug.trim().length >= 3),
    },
    {
      id: 'content-coverage',
      label: 'Content body available (300+ chars)',
      passed: bodyText.length >= 300,
    },
    {
      id: 'keyword-match',
      label: 'Primary keyword appears in slug or intro',
      passed: Boolean(firstWord)
        && (
          String(input.slug || '').toLowerCase().includes(firstWord)
          || bodyText.slice(0, 220).toLowerCase().includes(firstWord)
        ),
    },
    {
      id: 'social-image',
      label: 'Social preview image present',
      passed: Boolean((input.ogImageUrl || input.coverImageUrl || '').trim()),
    },
  ];

  const passCount = checks.filter((check) => check.passed).length;
  const score = clamp(Math.round((passCount / checks.length) * 100), 0, 100);
  return { score, checks };
};
