import { useEffect, useState } from 'react';

export const usePageVisibility = () => {
  const [visible, setVisible] = useState(() => {
    if (typeof document === 'undefined') return true;
    return !document.hidden;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const handleVisibility = () => {
      setVisible(!document.hidden);
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  return visible;
};

export default usePageVisibility;
