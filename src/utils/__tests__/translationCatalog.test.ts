import { describe, expect, it } from 'vitest';
import {
  buildCmsLocaleCoverageSummaries,
  buildTranslationLanguageSummaries,
  buildTranslationLeafRows,
  buildTranslationNamespaceSummary,
  flattenTranslationObject,
  unflattenTranslationObject,
} from '../translationCatalog';

describe('translationCatalog utils', () => {
  it('flattens and unflattens nested translation objects', () => {
    const flattened = flattenTranslationObject({
      common: {
        home: 'Home',
      },
      admin: {
        translations: 'Translations',
      },
    });

    expect(flattened).toEqual({
      'common.home': 'Home',
      'admin.translations': 'Translations',
    });

    expect(unflattenTranslationObject(flattened)).toEqual({
      common: {
        home: 'Home',
      },
      admin: {
        translations: 'Translations',
      },
    });
  });

  it('builds language and namespace summaries from effective rows', () => {
    const rows = buildTranslationLeafRows({
      hi: {
        common: {
          home: 'होम',
        },
      },
    });

    const targetRows = rows.filter((row) => row.key === 'common.home' || row.key === 'admin.translations');
    const hiSummary = buildTranslationLanguageSummaries(targetRows).find((entry) => entry.language === 'hi');
    const namespaceSummary = buildTranslationNamespaceSummary(targetRows, 'hi').find((entry) => entry.namespace === 'common');

    expect(hiSummary).toBeTruthy();
    expect(hiSummary?.translatedCount).toBeGreaterThanOrEqual(1);
    expect(namespaceSummary?.translatedCount).toBe(1);
  });

  it('computes cms locale coverage for frontend pages and blog posts', () => {
    const coverage = buildCmsLocaleCoverageSummaries(
      [
        {
          slug: 'home',
          title: 'Home',
          kind: 'generic',
          status: 'published',
          titleByLocale: { hi: 'होम' },
          excerptByLocale: { hi: 'सारांश' },
          contentJsonByLocale: { hi: '{"hero":"हाँ"}' },
          seoTitleByLocale: { hi: 'होम SEO' },
          seoDescriptionByLocale: { hi: 'होम विवरण' },
          createdBy: 'admin',
          updatedBy: 'admin',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        },
      ],
      [
        {
          slug: 'post-1',
          title: 'Post',
          status: 'published',
          titleByLocale: { hi: 'पोस्ट' },
          excerptByLocale: { hi: 'पोस्ट सारांश' },
          contentJsonByLocale: { hi: '{"html":"<p>नमस्ते</p>"}' },
          seoTitleByLocale: { hi: 'पोस्ट SEO' },
          seoDescriptionByLocale: { hi: 'पोस्ट विवरण' },
          createdBy: 'admin',
          updatedBy: 'admin',
          createdAt: new Date() as any,
          updatedAt: new Date() as any,
        },
      ],
    );

    const frontendCoverage = coverage.find((entry) => entry.surface === 'frontendPages' && entry.language === 'hi');
    const blogCoverage = coverage.find((entry) => entry.surface === 'blogPosts' && entry.language === 'hi');

    expect(frontendCoverage?.completionPercent).toBe(100);
    expect(blogCoverage?.completionPercent).toBe(100);
  });
});
