import { cn } from '../utils/cn';

export type TierOption = {
  key: string;
  label: string;
  xp: number;
};

export type TierChipsProps = {
  tiers: TierOption[];
  selectedTier: string | null;
  onSelect: (tierKey: string) => void;
  disabled?: boolean;
  className?: string;
  chipClassName?: string;
};

export function TierChips({
  tiers,
  selectedTier,
  onSelect,
  disabled = false,
  className,
  chipClassName,
}: TierChipsProps) {
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {tiers.map((tier) => {
        const isSelected = selectedTier === tier.key;
        return (
          <button
            key={tier.key}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tier.key)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-wider transition disabled:opacity-50',
              isSelected
                ? 'border-[var(--accent-red)] bg-[var(--accent-red)]/10 text-[var(--accent-red)]'
                : 'border-[var(--border)] bg-[var(--surface-raised)] text-[var(--text-muted)] hover:border-[var(--accent-red)]/50 hover:text-[var(--text-primary)]',
              chipClassName,
            )}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {tier.label}
            <span className="ml-1.5 text-[var(--success)]">+{tier.xp}</span>
          </button>
        );
      })}
    </div>
  );
}
