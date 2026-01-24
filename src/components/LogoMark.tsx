import React, { useId } from 'react';

interface LogoMarkProps {
  className?: string;
  title?: string;
}

const LogoMark: React.FC<LogoMarkProps> = ({ className = 'w-9 h-9', title }) => {
  const uid = useId().replace(/:/g, '');
  const gradientId = `bloodhub-gradient-${uid}`;
  const clipId = `bloodhub-clip-${uid}`;

  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dc2626" />
          <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
        <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
          <path d="M30 6C20 18 12 28 12 40C12 52 22 60 30 60C38 60 48 52 48 40C48 28 40 18 30 6Z" />
        </clipPath>
      </defs>
      <path
        d="M30 6C20 18 12 28 12 40C12 52 22 60 30 60C38 60 48 52 48 40C48 28 40 18 30 6Z"
        fill={`url(#${gradientId})`}
      />
      <path
        d="M46 30C56 30 62 31 63 32C62 33 56 34 46 34Z"
        fill={`url(#${gradientId})`}
      />
      <g clipPath={`url(#${clipId})`}>
        <path
          d="M16 36H22L26 30L30 42L34 32L38 36H44"
          stroke="#ffffff"
          strokeWidth="4.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
};

export default LogoMark;
