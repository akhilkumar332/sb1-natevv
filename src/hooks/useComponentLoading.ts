// src/hooks/useComponentLoading.ts
import { useState, useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';

export const useComponentLoading = (delay: number = 1000) => {
  const [isReady, setIsReady] = useState(false);
  const { showLoading, hideLoading } = useLoading();

  useEffect(() => {
    showLoading();
    const timer = setTimeout(() => {
      hideLoading();
      setIsReady(true);
    }, delay);

    return () => {
      clearTimeout(timer);
      hideLoading();
    };
  }, [delay, showLoading, hideLoading]);

  return isReady;
};