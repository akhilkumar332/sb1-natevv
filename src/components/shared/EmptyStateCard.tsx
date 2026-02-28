import type { ReactNode } from 'react';

export function EmptyStateCard({
  icon,
  title,
  description,
  className = 'bg-white rounded-2xl shadow-xl p-10 text-center',
  action,
}: {
  icon?: ReactNode;
  title?: string;
  description: string;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div className={className}>
      {icon}
      {title ? <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3> : null}
      <p className="text-gray-600">{description}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
