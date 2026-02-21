import { Download } from 'lucide-react';
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
  const { canInstall, promptInstall } = usePwaInstallPrompt();

  if (!canInstall) return null;

  return (
    <div className="pt-2">
      <button
        type="button"
        onClick={promptInstall}
        className={`${baseButtonClass} ${buttonClassName}`}
      >
        <Download className="w-5 h-5 mr-2" />
        {label}
      </button>
      <p className="mt-2 text-center text-xs text-gray-500">{helperText}</p>
    </div>
  );
}

export default PwaInstallCta;
