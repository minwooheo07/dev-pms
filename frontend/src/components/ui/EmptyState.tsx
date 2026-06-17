import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 text-center', className)}>
      {icon && (
        <div className="relative mb-5">
          {/* 부드러운 그라데이션 글로우 */}
          <div className="absolute inset-0 -z-10 m-auto w-20 h-20 rounded-full bg-gradient-to-br from-indigo-200/60 via-violet-200/50 to-transparent blur-2xl" />
          {/* 아이콘 타일 */}
          <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 ring-1 ring-indigo-100/80 shadow-sm flex items-center justify-center text-indigo-400">
            {icon}
          </div>
        </div>
      )}
      <h3 className="text-base font-semibold text-gray-700 mb-1">{title}</h3>
      {description && <p className="text-sm text-gray-400 mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
