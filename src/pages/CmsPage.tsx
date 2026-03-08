import { useParams } from 'react-router-dom';
import { CMS_DEFAULTS, CMS_SEO_DEFAULTS } from '../constants/cms';
import { ROUTES } from '../constants/routes';
import { usePublicCmsSettings, usePublishedCmsPageBySlug } from '../hooks/useCmsContent';
import SeoHead from '../components/SeoHead';
import { buildBreadcrumbSchema, buildWebPageSchema } from '../utils/seoStructuredData';
import { parseCmsRichContent } from '../utils/cmsRichContent';

export default function CmsPageRenderer() {
  const { slug = '' } = useParams();
  const pageQuery = usePublishedCmsPageBySlug(slug);
  const settingsQuery = usePublicCmsSettings();
  const siteTitle = settingsQuery.data?.siteTitle || CMS_DEFAULTS.siteTitle;
  const defaultSeoDescription = settingsQuery.data?.defaultSeoDescription || CMS_DEFAULTS.defaultSeoDescription;
  const canonicalBaseUrl = settingsQuery.data?.canonicalBaseUrl || CMS_DEFAULTS.canonicalBaseUrl;
  const defaultOgImageUrl = settingsQuery.data?.defaultOgImageUrl || '';
  const robotsPolicy = settingsQuery.data?.robotsPolicy === 'noindex_nofollow' ? 'noindex,nofollow' : 'index,follow';
  const canonicalPath = ROUTES.cmsPage.replace(':slug', slug);
  const resolvedTitle = pageQuery.data?.seoTitle || pageQuery.data?.title || 'Page';
  const resolvedDescription = pageQuery.data?.seoDescription || pageQuery.data?.excerpt || defaultSeoDescription;

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
            <h1 className="text-2xl font-bold text-gray-900">Unable to load page</h1>
            <p className="mt-2 text-sm text-gray-600">Please try again in a moment.</p>
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
            <h1 className="text-2xl font-bold text-gray-900">Page not found</h1>
            <p className="mt-2 text-sm text-gray-600">The requested page is unavailable or unpublished.</p>
          </div>
        </div>
      </>
    );
  }

  const page = pageQuery.data;
  const renderedContent = parseCmsRichContent(page.contentJson);
  const breadcrumbSchema = buildBreadcrumbSchema({
    baseUrl: canonicalBaseUrl,
    items: [
      { name: 'Home', path: ROUTES.home },
      { name: page.title, path: canonicalPath },
    ],
  });
  const webPageSchema = buildWebPageSchema({
    baseUrl: canonicalBaseUrl,
    path: canonicalPath,
    name: page.title,
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
            <h1 className="text-3xl font-extrabold text-gray-900">{page.title}</h1>
            {page.excerpt ? <p className="mt-3 text-sm text-gray-600">{page.excerpt}</p> : null}
            {renderedContent.html ? (
              <div
                className="mt-6 text-base leading-7 text-gray-700 [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-red-200 [&_blockquote]:pl-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-semibold [&_li]:mb-1 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6"
                dangerouslySetInnerHTML={{ __html: renderedContent.html }}
              />
            ) : (
              <div className="mt-6 space-y-4 text-base leading-7 text-gray-700">
                <p>No content available.</p>
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
