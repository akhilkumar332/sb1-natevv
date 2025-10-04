/**
 * LazyImage Component
 *
 * Optimized image component with lazy loading and placeholder
 */

import React, { useState, useEffect, useRef } from 'react';

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  placeholderSrc?: string;
  threshold?: number;
  rootMargin?: string;
}

/**
 * LazyImage Component with Intersection Observer
 */
export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  placeholderSrc,
  threshold = 0.1,
  rootMargin = '50px',
  className = '',
  ...props
}) => {
  const [imageSrc, setImageSrc] = useState(placeholderSrc || '');
  const [imageLoaded, setImageLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    // Skip if IntersectionObserver is not supported
    if (!('IntersectionObserver' in window)) {
      setImageSrc(src);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setImageSrc(src);
            if (imgRef.current) {
              observer.unobserve(imgRef.current);
            }
          }
        });
      },
      {
        threshold,
        rootMargin,
      }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => {
      if (imgRef.current) {
        observer.unobserve(imgRef.current);
      }
    };
  }, [src, threshold, rootMargin]);

  return (
    <img
      ref={imgRef}
      src={imageSrc}
      alt={alt}
      className={`${className} ${
        imageLoaded ? 'opacity-100' : 'opacity-0'
      } transition-opacity duration-300`}
      onLoad={() => setImageLoaded(true)}
      loading="lazy"
      {...props}
    />
  );
};

export default LazyImage;
