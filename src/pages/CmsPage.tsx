import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CMS_DEFAULTS, CMS_SEO_DEFAULTS } from '../constants/cms';
import { ROUTES } from '../constants/routes';
import { usePublicCmsSettings, usePublishedCmsPageBySlug } from '../hooks/useCmsContent';
import SeoHead from '../components/SeoHead';
import { buildBreadcrumbSchema, buildWebPageSchema } from '../utils/seoStructuredData';
import { parseCmsRichContent } from '../utils/cmsRichContent';
import { pickLocalizedCmsString } from '../utils/cmsLocalization';

export default function CmsPageRenderer() {
  const { t, i18n } = useTranslation();
  const { slug = '' } = useParams();
  const pageQuery = usePublishedCmsPageBySlug(slug);
  const settingsQuery = usePublicCmsSettings();
  const siteTitle = settingsQuery.data?.siteTitle || CMS_DEFAULTS.siteTitle;
  const defaultSeoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';
  const canonicalPath = ROUTES.cmsPage.replace(':slug', slug);
  const localizedTitle = pickLocalizedCmsString(i18n.resolvedLanguage, pageQuery.data?.titleByLocale, pageQuery.data?.title || null);
  const localizedExcerpt = pickLocalizedCmsString(i18n.resolvedLanguage, pageQuery.data?.excerptByLocale, pageQuery.data?.excerpt || null);
  const localizedSeoTitle = pickLocalizedCmsString(i18n.resolvedLanguage, pageQuery.data?.seoTitleByLocale, pageQuery.data?.seoTitle || null);
  const localizedSeoDescription = pickLocalizedCmsString(i18n.resolvedLanguage, pageQuery.data?.seoDescriptionByLocale, pageQuery.data?.seoDescription || null);
  const resolvedTitle = localizedSeoTitle || localizedTitle || 'Page';
  const resolvedDescription = localizedSeoDescription || localizedExcerpt || defaultSeoDescription;

  if (pageQuery.isLoading) {
    return (
      <>
        <SeoHead title={siteTitle} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="h-72 animate-pulse rounded-2xl border border-red-100 bg-white" />
        </div>
      </>
    );
  }

  if (pageQuery.isError) {
    return (
      <>
        <SeoHead title={siteTitle} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{t('route.unableToLoadPage')}</h1>
            <p className="mt-2 text-sm text-gray-600">{t('route.tryAgainSoon')}</p>
          </div>
        </div>
      </>
    );
  }

  if (!pageQuery.data) {
    return (
      <>
        <SeoHead title={siteTitle} description={defaultSeoDescription} canonicalPath={canonicalPath} canonicalBaseUrl={canonicalBaseUrl} />
        <div className="container mx-auto px-4 py-8">
          <div className="rounded-2xl border border-red-100 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{t('route.pageNotFound')}</h1>
            <p className="mt-2 text-sm text-gray-600">{t('route.requestedPageUnavailable')}</p>
          </div>
        </div>
      </>
    );
  }

  const page = pageQuery.data;
  const localizedPageTitle = pickLocalizedCmsString(i18n.resolvedLanguage, page.titleByLocale, page.title) || page.title;
  const localizedPageExcerpt = pickLocalizedCmsString(i18n.resolvedLanguage, page.excerptByLocale, page.excerpt || null);
  const localizedContentJson = pickLocalizedCmsString(i18n.resolvedLanguage, page.contentJsonByLocale, page.contentJson || null);
  const renderedContent = parseCmsRichContent(localizedContentJson);
  const breadcrumbSchema = buildBreadcrumbSchema({
    baseUrl: canonicalBaseUrl,
    items: [
      { name: CMS_DEFAULTS.siteTitle, path: ROUTES.home },
      { name: localizedPageTitle, path: canonicalPath },
    ],
  });
  const webPageSchema = buildWebPageSchema({
    baseUrl: canonicalBaseUrl,
    path: canonicalPath,
    name: localizedPageTitle,
    description: resolvedDescription,
  });

  return (
    <>
      <SeoHead
        title={`${resolvedTitle} | ${siteTitle}`}
        description={resolvedDescription}
        type="website"
        siteName={siteTitle}
        locale={CMS_SEO_DEFAULTS.locale}
        canonicalPath={canonicalPath}
        canonicalBaseUrl={canonicalBaseUrl}
        canonicalUrl={page.seoCanonicalUrl || undefined}
        ogImageUrl={page.ogImageUrl || page.coverImageUrl || defaultOgImageUrl || undefined}
        twitterImageUrl={page.twitterImageUrl || page.ogImageUrl || page.coverImageUrl || defaultOgImageUrl || undefined}
        twitterHandle={settingsQuery.data?.twitterHandle || undefined}
        robots={page.seoNoIndex || page.seoNoFollow ? 'noindex,nofollow' : robotsPolicy}
        structuredData={[breadcrumbSchema, webPageSchema]}
      />
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900">{localizedPageTitle}</h1>
            {localizedPageExcerpt ? <p className="mt-3 text-sm text-gray-600">{localizedPageExcerpt}</p> : null}
            {renderedContent.html ? (
              <div
                className="mt-6 text-base leading-7 text-gray-700 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-red-200 [&_blockquote]:pl-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: renderedContent.html }}
              />
            ) : (
              <div className="mt-6 space-y-4 text-base leading-7 text-gray-700">
                <p>{t('route.noContentAvailable')}</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
