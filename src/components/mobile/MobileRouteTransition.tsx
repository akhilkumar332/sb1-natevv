import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

type Props = {
  enabled: boolean;
  children: ReactNode;
};

export default function MobileRouteTransition({ enabled, children }: Props) {
  const location = useLocation();

  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div key={location.pathname} className="mobile-route-transition">
      {children}
    </div>
  );
}
