import { useParams } from 'react-router-dom';
import { CMS_DEFAULTS } from '../constants/cms';
import { ROUTES } from '../constants/routes';
import { usePublicCmsSettings, usePublishedCmsPageBySlug } from '../hooks/useCmsContent';
import SeoHead from '../components/SeoHead';

const renderContent = (contentJson?: string | null) => {
  if (!contentJson) return ['No content available.'];
  try {
    const parsed = JSON.parse(contentJson) as { blocks?: Array<{ text?: string }> };
    if (!Array.isArray(parsed.blocks)) return [contentJson];
    return parsed.blocks
      .map((block) => (typeof block?.text === 'string' ? block.text : ''))
      .filter(Boolean);
  } catch {
    return [contentJson];
  }
};

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
  const paragraphs = renderContent(page.contentJson);

  return (
    <>
      <SeoHead
        title={`${resolvedTitle} | ${siteTitle}`}
        description={resolvedDescription}
        canonicalPath={canonicalPath}
        canonicalBaseUrl={canonicalBaseUrl}
        canonicalUrl={page.seoCanonicalUrl || undefined}
        ogImageUrl={page.ogImageUrl || page.coverImageUrl || defaultOgImageUrl || undefined}
        twitterImageUrl={page.twitterImageUrl || page.ogImageUrl || page.coverImageUrl || defaultOgImageUrl || undefined}
        robots={page.seoNoIndex || page.seoNoFollow ? 'noindex,nofollow' : robotsPolicy}
      />
      <section className="py-8">
        <div className="container mx-auto px-4">
          <div className="mx-auto max-w-3xl rounded-2xl border border-red-100 bg-white p-6 shadow-sm sm:p-8">
            <h1 className="text-3xl font-extrabold text-gray-900">{page.title}</h1>
            {page.excerpt ? <p className="mt-3 text-sm text-gray-600">{page.excerpt}</p> : null}
            <div className="mt-6 space-y-4 text-base leading-7 text-gray-700">
              {paragraphs.map((line, index) => <p key={`line-${index}`}>{line}</p>)}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
