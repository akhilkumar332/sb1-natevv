import { CMS_SEO_GUIDELINES } from '../../constants/cms';

type SeoSnippetPreviewProps = {
  title: string;
  description: string;
  url: string;
};

const truncate = (value: string, length: number) => {
  if (value.length <= length) return value;
  return `${value.slice(0, Math.max(0, length - 1)).trim()}…`;
};

export default function SeoSnippetPreview({ title, description, url }: SeoSnippetPreviewProps) {
  const safeTitle = (title || 'Untitled page').trim();
  const safeDescription = (description || 'No search description yet.').trim();
  const safeUrl = (url || 'https://example.com').trim();

  return (
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-blue-700">Google Preview</p>
      <div className="mt-2 rounded-lg border border-blue-100 bg-white p-3">
        <p className="text-sm font-medium text-blue-800">{truncate(safeUrl, 62)}</p>
        <p className="mt-1 text-lg font-medium leading-6 text-blue-700">{truncate(safeTitle, CMS_SEO_GUIDELINES.snippetTitleSoftMax)}</p>
        <p className="mt-1 text-sm leading-5 text-gray-700">{truncate(safeDescription, CMS_SEO_GUIDELINES.snippetDescriptionSoftMax)}</p>
      </div>
    </div>
  );
}
