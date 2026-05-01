import { Download, Share2, X } from 'lucide-react';
import { usePwaInstallPrompt } from '../hooks/usePwaInstallPrompt';

type PwaInstallCtaProps = {
  label: string;
  buttonClassName?: string;
  helperText?: string;
};

const baseButtonClass =
  'w-full flex items-center justify-center px-6 py-4 rounded-xl font-semibold transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2';

export function PwaInstallCta({
  label,
  buttonClassName = '',
  helperText = 'Install for faster access and offline support.',
}: PwaInstallCtaProps) {
  const {
    canInstall,
    promptInstall,
    isIosInstallGuidanceVisible,
    dismissInstallPrompt,
  } = usePwaInstallPrompt();

  if (!canInstall && !isIosInstallGuidanceVisible) return null;

  return (
    <div className="pt-2">
      {canInstall ? (
        <>
          <button
            type="button"
            onClick={promptInstall}
            className={`${baseButtonClass} ${buttonClassName}`}
          >
            <Download className="w-5 h-5 mr-2" />
            {label}
          </button>
          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-center text-xs text-gray-500">{helperText}</p>
            <button
              type="button"
              onClick={dismissInstallPrompt}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Dismiss install prompt"
            >
              <X className="h-3.5 w-3.5" />
              Dismiss
            </button>
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-blue-100 bg-blue-50/80 p-4 text-left shadow-sm dark:border-blue-500/20 dark:bg-blue-500/10">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Install on iPhone or iPad</p>
              <p className="mt-1 text-xs text-blue-800 dark:text-blue-100">
                Open Safari’s <span className="font-semibold">Share</span> menu, then choose <span className="font-semibold">Add to Home Screen</span> for a faster app-like experience.
              </p>
            </div>
            <button
              type="button"
              onClick={dismissInstallPrompt}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-blue-700 transition-colors hover:bg-blue-100 dark:text-blue-200 dark:hover:bg-blue-500/20"
              aria-label="Dismiss install guidance"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/80 px-3 py-2 text-xs font-semibold text-blue-900 dark:bg-slate-900/50 dark:text-blue-100">
            <Share2 className="h-4 w-4" />
            Share → Add to Home Screen
          </div>
        </div>
      )}
    </div>
  );
}

export default PwaInstallCta;
