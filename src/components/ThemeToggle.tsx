import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useTranslation } from 'react-i18next';

type ThemeToggleProps = {
  className?: string;
};

function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm transition-all hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:border-gray-700 dark:focus:ring-offset-surface-base ${className}`}
      aria-label={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
      title={isDark ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-text-secondary" />}
      <span>{isDark ? t('theme.light') : t('theme.dark')}</span>
    </button>
  );
}

export default ThemeToggle;
