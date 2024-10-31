// src/hoc/withLoading.tsx
import React, { useEffect } from 'react';
import { useLoading } from '../contexts/LoadingContext';

export const withLoading = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  loadingTime: number = 1000
) => {
  return function WithLoadingComponent(props: P) {
    const { showLoading, hideLoading } = useLoading();

    useEffect(() => {
      showLoading();
      const timer = setTimeout(() => {
        hideLoading();
      }, loadingTime);

      return () => {
        clearTimeout(timer);
        hideLoading();
      };
    }, []);

    return <WrappedComponent {...props} />;
  };
};