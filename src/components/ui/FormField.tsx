import type { InputHTMLAttributes } from 'react';

interface FormInputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  showCount?: boolean;
}

export function FormInput({
  id,
  label,
  required = false,
  error,
  showCount = false,
  maxLength,
  value,
  className = '',
  ...props
}: FormInputProps) {
  const currentLength = typeof value === 'string' ? value.length : 0;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-[var(--text-primary)]">
          {label}
          {required && (
            <span className="ml-0.5 text-[var(--status-err-fg)]" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {showCount && maxLength && (
          <span className="font-mono text-[11px] text-[var(--text-muted)]">
            {currentLength}/{maxLength}
          </span>
        )}
      </div>

      <input
        id={id}
        value={value}
        maxLength={maxLength}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-md border bg-[var(--bg-canvas)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition ${
          error
            ? 'border-[var(--status-err-fg)] focus:border-[var(--status-err-fg)]'
            : 'border-[var(--border)] focus:border-[var(--text-primary)]'
        } ${className}`}
        {...props}
      />

      {error && (
        <p id={`${id}-error`} role="alert" className="text-xs text-[var(--status-err-fg)]">
          {error}
        </p>
      )}
    </div>
  );
}
