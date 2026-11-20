import type { ReactNode } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

interface BadgeProps {
  variant?: BadgeVariant;
  children: ReactNode;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: 'bg-[var(--bg-surface)] text-[var(--text-secondary)] border-[var(--border)]',
  success: 'bg-[var(--status-ok-bg)] text-[var(--status-ok-fg)] border-[var(--status-ok-border)]',
  warning: 'bg-[var(--status-warn-bg)] text-[var(--status-warn-fg)] border-[var(--status-warn-border)]',
  error: 'bg-[var(--status-err-bg)] text-[var(--status-err-fg)] border-[var(--status-err-border)]',
};

export function Badge({ variant = 'neutral', children, className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${variantClasses[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
