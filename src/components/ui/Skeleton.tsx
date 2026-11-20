import { Loader2 } from 'lucide-react';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[var(--bg-hover)] ${className}`}
    />
  );
}

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label, className = '' }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-[var(--text-secondary)] ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin text-[var(--text-primary)]" />
      {label && <span>{label}</span>}
    </span>
  );
}
