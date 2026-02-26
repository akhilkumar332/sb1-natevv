import { useEffect, useState } from 'react';

type ViewportState = {
  width: number;
  isPhone: boolean;
  isTablet: boolean;
  isMobileOrTablet: boolean;
};

const getWidth = () => {
  if (typeof window === 'undefined') return 1280;
  return window.innerWidth;
};

const resolveState = (width: number): ViewportState => {
  const isPhone = width < 768;
  const isTablet = width >= 768 && width < 1024;
  return {
    width,
    isPhone,
    isTablet,
    isMobileOrTablet: isPhone || isTablet,
  };
};

export function useViewport() {
  const [state, setState] = useState<ViewportState>(() => resolveState(getWidth()));

  useEffect(() => {
    const onResize = () => {
      setState(resolveState(getWidth()));
    };

    window.addEventListener('resize', onResize, { passive: true });
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return state;
}
