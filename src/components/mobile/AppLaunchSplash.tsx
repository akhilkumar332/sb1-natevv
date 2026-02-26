import { useEffect, useState } from 'react';
import LogoMark from '../LogoMark';

const SPLASH_KEY = 'bh_mobile_launch_seen';
const SPLASH_MIN_MS = 900;

export default function AppLaunchSplash({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      setVisible(false);
      return;
    }

    try {
      const seen = window.sessionStorage.getItem(SPLASH_KEY);
      if (seen) {
        setVisible(false);
        return;
      }
      window.sessionStorage.setItem(SPLASH_KEY, '1');
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), SPLASH_MIN_MS);
      return () => window.clearTimeout(timer);
    } catch {
      setVisible(true);
      const timer = window.setTimeout(() => setVisible(false), SPLASH_MIN_MS);
      return () => window.clearTimeout(timer);
    }
  }, [enabled]);

  if (!visible) return null;

  return (
    <div className="mobile-launch-splash" role="status" aria-live="polite" aria-label="Loading BloodHub">
      <div className="mobile-launch-content">
        <LogoMark className="h-14 w-14 animate-pulse" />
        <p className="mt-4 text-lg font-bold tracking-wide text-white">BloodHub India</p>
        <div className="mobile-launch-loader mt-4" />
      </div>
    </div>
  );
}
