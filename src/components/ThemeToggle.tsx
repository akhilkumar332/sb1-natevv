import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type ThemeToggleProps = {
  className?: string;
};

function ThemeToggle({ className = '' }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center gap-2 rounded-full border border-gray-200 bg-surface-card px-3 py-2 text-xs font-semibold text-text-secondary shadow-sm transition-all hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:border-gray-700 dark:focus:ring-offset-surface-base ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="h-4 w-4 text-amber-300" /> : <Moon className="h-4 w-4 text-text-secondary" />}
      <span>{isDark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

export default ThemeToggle;
