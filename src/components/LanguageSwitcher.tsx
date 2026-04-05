import { useEffect, useRef, useState } from 'react';
import { Globe2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
  getLanguageNativeLabel,
  isSupportedLanguage,
  SUPPORTED_LANGUAGES,
  type SupportedLanguage,
} from '../locales';

type LanguageSwitcherProps = {
  className?: string;
  menuAlign?: 'left' | 'right';
};

function LanguageSwitcher({ className = '', menuAlign = 'right' }: LanguageSwitcherProps) {
  const { i18n, t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const currentLanguage: SupportedLanguage = isSupportedLanguage(i18n.resolvedLanguage)
    ? i18n.resolvedLanguage
    : 'en';

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleMenu = () => setIsOpen((prev) => !prev);
  const handleLanguageChange = (language: SupportedLanguage) => {
    void i18n.changeLanguage(language);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={toggleMenu}
        className="inline-flex items-center justify-center rounded-full border border-gray-200 bg-surface-card px-3 py-2 text-text-secondary shadow-sm transition-all hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:border-gray-700 dark:focus:ring-offset-surface-base"
        aria-label={t('language.switch')}
        title={t('language.switch')}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <Globe2 className="h-4 w-4" />
      </button>

      {isOpen && (
        <div
          className={`absolute top-full z-50 mt-2 min-w-40 rounded-2xl border border-gray-200 bg-white/95 p-2 shadow-2xl backdrop-blur-xl dark:border-gray-700 dark:bg-[#0b1220]/95 ${
            menuAlign === 'left' ? 'left-0' : 'right-0'
          }`}
          role="menu"
        >
          {SUPPORTED_LANGUAGES.map((language) => {
            const isActive = currentLanguage === language;
            return (
              <button
                key={language}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => handleLanguageChange(language)}
                className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-gradient-to-r from-red-600 to-red-700 text-white'
                    : 'text-gray-700 hover:bg-red-50 dark:text-gray-200 dark:hover:bg-red-500/10'
                }`}
              >
                <span>{getLanguageNativeLabel(language)}</span>
                {isActive && <span className="text-[10px] font-semibold uppercase tracking-wider">{t('language.current')}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default LanguageSwitcher;
