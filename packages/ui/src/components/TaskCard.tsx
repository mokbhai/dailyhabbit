import { useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'REJECTED';

export type TaskCardProps = {
  icon: string;
  title: string;
  status: TaskStatus;
  defaultExpanded?: boolean;
  children?: ReactNode;
  className?: string;
  headerClassName?: string;
  badgeClassName?: string;
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  PENDING:
    'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)]',
  COMPLETED:
    'border-[var(--success)]/30 bg-[var(--success)]/10 text-[var(--success)]',
  OVERDUE:
    'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
  REJECTED:
    'border-[var(--accent-red)]/30 bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
};

export function TaskCard({
  icon,
  title,
  status,
  defaultExpanded = false,
  children,
  className,
  headerClassName,
  badgeClassName,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-[var(--surface-raised)]',
          headerClassName,
        )}
      >
        <span className="text-2xl" aria-hidden>
          {icon}
        </span>
        <span className="flex-1 font-medium text-[var(--text-primary)]">
          {title}
        </span>
        <span
          className={cn(
            'inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide',
            STATUS_STYLES[status],
            badgeClassName,
          )}
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {status}
        </span>
        <span className="ml-1 shrink-0 text-[var(--text-muted)]">
          {expanded ? '−' : '+'}
        </span>
      </button>

      {expanded && children && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          {children}
        </div>
      )}
    </div>
  );
}
