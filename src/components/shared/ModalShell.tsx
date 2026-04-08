import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ModalShell({
  children,
  containerClassName = 'w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl',
}: {
  children: ReactNode;
  containerClassName?: string;
}) {
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={containerClassName}>{children}</div>
    </div>,
    document.body
  );
}
