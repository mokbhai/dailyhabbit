import { useState, type ReactNode } from 'react';
import { cn } from '../utils/cn';
import { NumberStepper } from './NumberStepper';
import { TierChips, type TierOption } from './TierChips';

export type TaskStatus = 'PENDING' | 'COMPLETED' | 'OVERDUE' | 'REJECTED';
export type ActivityKind = 'CHECKBOX' | 'NUMBER' | 'TIERED' | 'SUBPOINTS';
export type SubPointState = 'DONE' | 'FAILED' | 'UNLOGGED';

export type SubPointConfig = {
  key: string;
  label: string;
  xp: number;
};

export type ActivityLogView = {
  state: SubPointState | null;
  value: number | null;
  tier: string | null;
  subPoints: Record<string, SubPointState> | null;
  xpAwarded: number;
  proofUrl?: string | null;
  aiVerdict?: string | null;
};

export type TaskCardProps = {
  icon: string;
  title: string;
  kind: ActivityKind;
  log: ActivityLogView | null;
  canEdit: boolean;
  xpComplete?: number;
  unitLabel?: string;
  xpPerUnit?: number;
  xpCap?: number;
  subPoints?: SubPointConfig[];
  tiers?: TierOption[];
  onMarkDone?: () => void;
  onUndo?: () => void;
  onNumberCommit?: (value: number) => void;
  onTierSelect?: (tierKey: string) => void;
  onSubPointChange?: (states: Record<string, SubPointState>) => void;
  expandedContent?: ReactNode;
  disabled?: boolean;
  className?: string;
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

function deriveStatus(
  kind: ActivityKind,
  log: ActivityLogView | null,
  canEdit: boolean,
): TaskStatus {
  if (!log) {
    return canEdit ? 'PENDING' : 'OVERDUE';
  }

  if (kind === 'CHECKBOX') {
    if (log.state === 'DONE') return 'COMPLETED';
    if (log.state === 'FAILED') return 'REJECTED';
    return canEdit ? 'PENDING' : 'OVERDUE';
  }

  if (kind === 'NUMBER') {
    if (log.value != null && log.value > 0) return 'COMPLETED';
    if (log.state === 'FAILED') return 'REJECTED';
    return canEdit ? 'PENDING' : 'OVERDUE';
  }

  if (kind === 'TIERED') {
    if (log.tier != null) return 'COMPLETED';
    return canEdit ? 'PENDING' : 'OVERDUE';
  }

  if (kind === 'SUBPOINTS') {
    const states = log.subPoints ?? {};
    const keys = Object.keys(states);
    if (keys.length > 0) {
      const allDone = keys.every((key) => states[key] === 'DONE');
      const anyFailed = keys.some((key) => states[key] === 'FAILED');
      if (allDone) return 'COMPLETED';
      if (anyFailed && !keys.some((key) => states[key] === 'UNLOGGED')) {
        return 'REJECTED';
      }
    }
    if (log.state === 'DONE') return 'COMPLETED';
    if (log.state === 'FAILED') return 'REJECTED';
    return canEdit ? 'PENDING' : 'OVERDUE';
  }

  return canEdit ? 'PENDING' : 'OVERDUE';
}

function statusLabel(status: TaskStatus, xpAwarded: number): string {
  if (status === 'COMPLETED') {
    if (xpAwarded > 0) return `Done ✓ +${xpAwarded} XP`;
    if (xpAwarded < 0) return `Done ✓ ${xpAwarded} XP`;
    return 'Done ✓';
  }
  if (status === 'REJECTED') return 'Failed';
  if (status === 'OVERDUE') return 'Missed';
  return 'Tap to complete';
}

function hasExpandableContent(
  kind: ActivityKind,
  expandedContent?: ReactNode,
): boolean {
  return (
    kind === 'NUMBER' ||
    kind === 'TIERED' ||
    kind === 'SUBPOINTS' ||
    Boolean(expandedContent)
  );
}

function bodyTapEnabled(kind: ActivityKind): boolean {
  return kind === 'CHECKBOX' || kind === 'SUBPOINTS';
}

export function TaskCard({
  icon,
  title,
  kind,
  log,
  canEdit,
  xpComplete: _xpComplete,
  unitLabel = '',
  xpPerUnit = 0,
  xpCap = 0,
  subPoints = [],
  tiers = [],
  onMarkDone,
  onUndo,
  onNumberCommit,
  onTierSelect,
  onSubPointChange,
  expandedContent,
  disabled = false,
  className,
}: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const status = deriveStatus(kind, log, canEdit);
  const xpAwarded = log?.xpAwarded ?? 0;
  const isComplete = status === 'COMPLETED';
  const showExpand = hasExpandableContent(kind, expandedContent);
  const canBodyTap = bodyTapEnabled(kind) && canEdit && !disabled;

  function handleBodyTap() {
    if (!canEdit || disabled) return;
    if (isComplete) {
      onUndo?.();
      return;
    }
    if (canBodyTap) {
      onMarkDone?.();
    }
  }

  function handleSubPointToggle(key: string, next: 'DONE' | 'FAILED') {
    const current = log?.subPoints ?? {};
    const initial: Record<string, SubPointState> = {};
    for (const sp of subPoints) {
      initial[sp.key] = current[sp.key] ?? 'UNLOGGED';
    }
    const updated = { ...initial, [key]: next };
    onSubPointChange?.(updated);
  }

  const numberValue = log?.value ?? 0;

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]',
        isComplete && 'border-[var(--success)]/20',
        className,
      )}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={handleBodyTap}
          disabled={!canEdit || disabled || (!isComplete && !canBodyTap)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-3 px-4 py-4 text-left transition',
            (canBodyTap || isComplete) && canEdit && !disabled
              ? 'cursor-pointer hover:bg-[var(--surface-raised)]'
              : 'cursor-default',
            disabled && 'opacity-50',
          )}
        >
          <span className="text-2xl" aria-hidden>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium text-[var(--text-primary)]">
              {title}
            </span>
            {xpAwarded !== 0 && status !== 'COMPLETED' && (
              <span className="mt-0.5 block text-xs text-[var(--success)]">
                {xpAwarded > 0 ? '+' : ''}
                {xpAwarded} XP
              </span>
            )}
          </span>
          <span
            className={cn(
              'inline-flex shrink-0 items-center whitespace-nowrap rounded-md border px-3 py-1 text-[10px] font-semibold uppercase tracking-wide',
              STATUS_STYLES[status],
            )}
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {statusLabel(status, xpAwarded)}
          </span>
        </button>

        {showExpand && (
          <button
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse' : 'Expand'}
            onClick={() => setExpanded((open) => !open)}
            className="flex w-12 shrink-0 items-center justify-center border-l border-[var(--border)] text-[var(--text-muted)] transition hover:bg-[var(--surface-raised)] hover:text-[var(--text-primary)]"
          >
            {expanded ? '−' : '+'}
          </button>
        )}
      </div>

      {expanded && showExpand && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          {kind === 'NUMBER' && onNumberCommit && (
            <NumberStepper
              value={numberValue}
              unitLabel={unitLabel}
              quickSteps={[0.5, 1, 2]}
              xpPerUnit={xpPerUnit}
              xpCap={xpCap}
              onChange={() => {}}
              onCommit={onNumberCommit}
              disabled={!canEdit || disabled}
            />
          )}

          {kind === 'TIERED' && onTierSelect && (
            <TierChips
              tiers={tiers}
              selectedTier={log?.tier ?? null}
              onSelect={onTierSelect}
              disabled={!canEdit || disabled}
            />
          )}

          {kind === 'SUBPOINTS' && onSubPointChange && (
            <div className="space-y-2">
              {subPoints.map((sp) => {
                const state = log?.subPoints?.[sp.key] ?? 'UNLOGGED';
                return (
                  <div
                    key={sp.key}
                    className="flex items-center justify-between gap-3 rounded border border-[var(--border)] bg-[var(--surface-raised)] px-3 py-2"
                  >
                    <span className="text-sm text-[var(--text-primary)]">
                      {sp.label}
                      <span className="ml-2 text-xs text-[var(--success)]">
                        +{sp.xp}
                      </span>
                    </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        disabled={!canEdit || disabled}
                        onClick={() => handleSubPointToggle(sp.key, 'DONE')}
                        className={cn(
                          'rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition disabled:opacity-50',
                          state === 'DONE'
                            ? 'bg-[var(--success)]/20 text-[var(--success)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--success)]',
                        )}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Done
                      </button>
                      <button
                        type="button"
                        disabled={!canEdit || disabled}
                        onClick={() => handleSubPointToggle(sp.key, 'FAILED')}
                        className={cn(
                          'rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition disabled:opacity-50',
                          state === 'FAILED'
                            ? 'bg-[var(--accent-red)]/20 text-[var(--accent-red)]'
                            : 'text-[var(--text-muted)] hover:text-[var(--accent-red)]',
                        )}
                        style={{ fontFamily: 'var(--font-mono)' }}
                      >
                        Failed
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {expandedContent}
        </div>
      )}

      {!showExpand && expandedContent && (
        <div className="border-t border-[var(--border)] px-4 py-4">
          {expandedContent}
        </div>
      )}
    </div>
  );
}
