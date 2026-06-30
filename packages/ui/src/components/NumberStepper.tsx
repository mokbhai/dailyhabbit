import { useEffect, useState } from 'react';
import { cn } from '../utils/cn';

export type NumberStepperProps = {
  value: number;
  unitLabel: string;
  quickSteps: number[];
  xpPerUnit: number;
  xpCap: number;
  onChange: (value: number) => void;
  onCommit: (value: number) => void;
  disabled?: boolean;
  className?: string;
};

function computeXpPreview(value: number, xpPerUnit: number, xpCap: number) {
  return Math.min(Math.round(value * xpPerUnit), xpCap);
}

export function NumberStepper({
  value,
  unitLabel,
  quickSteps,
  xpPerUnit,
  xpCap,
  onChange,
  onCommit,
  disabled = false,
  className,
}: NumberStepperProps) {
  const [inputValue, setInputValue] = useState(String(value));

  useEffect(() => {
    setInputValue(String(value));
  }, [value]);

  const numericValue = Math.max(0, Number(inputValue) || 0);
  const xpPreview = computeXpPreview(numericValue, xpPerUnit, xpCap);

  function commit(next: number) {
    const clamped = Math.max(0, next);
    setInputValue(String(clamped));
    onChange(clamped);
    onCommit(clamped);
  }

  function adjust(delta: number) {
    commit(numericValue + delta);
  }

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => adjust(-1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-raised)] text-lg text-[var(--text-primary)] transition hover:border-[var(--accent-red)] disabled:opacity-50"
          aria-label="Decrease"
        >
          −
        </button>
        <div className="flex flex-1 items-center gap-2">
          <input
            type="number"
            min={0}
            step="any"
            disabled={disabled}
            value={inputValue}
            onChange={(event) => {
              setInputValue(event.target.value);
              const parsed = Math.max(0, Number(event.target.value) || 0);
              onChange(parsed);
            }}
            onBlur={() => commit(numericValue)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                commit(numericValue);
              }
            }}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2 text-center text-[var(--text-primary)] outline-none focus:border-[var(--accent-red)] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)' }}
          />
          <span className="shrink-0 text-xs uppercase tracking-wider text-[var(--text-muted)]">
            {unitLabel}
          </span>
        </div>
        <button
          type="button"
          disabled={disabled}
          onClick={() => adjust(1)}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-[var(--border)] bg-[var(--surface-raised)] text-lg text-[var(--text-primary)] transition hover:border-[var(--accent-red)] disabled:opacity-50"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {quickSteps.map((step) => (
          <button
            key={step}
            type="button"
            disabled={disabled}
            onClick={() => adjust(step)}
            className="rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-1 text-xs uppercase tracking-wider text-[var(--text-muted)] transition hover:border-[var(--accent-red)] hover:text-[var(--text-primary)] disabled:opacity-50"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            +{step} {unitLabel}
          </button>
        ))}
      </div>

      <p className="text-xs text-[var(--success)]">
        +{xpPreview} XP
        <span className="ml-1 text-[var(--text-muted)]">
          ({xpPerUnit} XP / {unitLabel}, cap {xpCap})
        </span>
      </p>
    </div>
  );
}

export { computeXpPreview };
